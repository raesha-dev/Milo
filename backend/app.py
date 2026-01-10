import os
import uuid
import time
import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

import logging
# OpenAI moved exception classes between versions (v1 vs legacy). Try both import locations


from google.cloud import language_v1, firestore, texttospeech, storage
try:
    import azure.cognitiveservices.speech as speechsdk # Importing Azure, and initialising to none till azure credits received
except ImportError:
    speechsdk = None

import google.auth
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account as gservice_account

from cloud_utils import (
    safe_cloud_operation,
    validate_google_credentials,
    CloudServiceError,
    RetryableError,
    NonRetryableError
)
import threading
import json
import requests
import base64
import binascii


def azure_speech_to_text(audio_bytes, language, content_type):
    """REST helper to send audio bytes to Azure Speech-to-Text and return transcript.

    Expects `audio_bytes` as raw bytes, `language` like 'en-US', and a `content_type` such
    as 'audio/wav' or 'audio/mpeg'. Raises HTTP exceptions on non-2xx responses.
    """
    key = os.environ.get('AZURE_SPEECH_KEY')
    region = os.environ.get('AZURE_SPEECH_REGION')
    if not key or not region:
        raise RuntimeError('Azure Speech not configured')

    url = f"https://{region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1"
    params = {'language': language}
    headers = {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': content_type,
        'Accept': 'application/json'
    }

    resp = requests.post(url, params=params, headers=headers, data=audio_bytes, timeout=30)
    resp.raise_for_status()

    # Try to parse JSON response; fall back to plain text
    try:
        j = resp.json()
    except Exception:
        return resp.text or ''

    # Azure STT returns 'DisplayText' on success; prefer it
    if isinstance(j, dict):
        if 'DisplayText' in j:
            return j.get('DisplayText') or ''
        nbest = j.get('NBest') or []
        if isinstance(nbest, list) and nbest:
            first = nbest[0]
            return first.get('Display', '') or first.get('Lexical', '') or ''

    return ''
def azure_openai_chat(messages, max_tokens=150):
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    api_key = os.getenv("AZURE_OPENAI_KEY")
    deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")

    def _call_openai_com(messages, max_tokens):
        openai_key = os.getenv("OPENAI_API_KEY")
        if not openai_key:
            raise RuntimeError("OPENAI_API_KEY not set for OpenAI.com fallback")
        try:
            import openai
            openai.api_key = openai_key
            model = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
            resp = openai.ChatCompletion.create(model=model, messages=messages, max_tokens=max_tokens, temperature=0.7)
            return resp["choices"][0]["message"]["content"]
        except Exception:
            raise

    # If Azure config absent, try OpenAI.com fallback
    if not all([endpoint, api_key, deployment]):
        try:
            return _call_openai_com(messages, max_tokens)
        except Exception as e:
            raise RuntimeError("Azure OpenAI not configured and OpenAI.com fallback failed: " + str(e))

    # Try Azure OpenAI first
    url = f"{endpoint}/openai/deployments/{deployment}/chat/completions?api-version={api_version}"
    headers = {"Content-Type": "application/json", "api-key": api_key}
    payload = {"messages": messages, "max_tokens": max_tokens}

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
    except Exception as azure_err:
        # Azure failed — attempt OpenAI.com fallback
        try:
            return _call_openai_com(messages, max_tokens)
        except Exception:
            # If fallback fails, re-raise the original Azure error for upstream handling
            raise azure_err

#Future Integration with Gemma trained models on data, language, sentiments, etc - now OpenAI usage

systemPrompt="""You are Milo — a kind, emotionally intelligent wellbeing companion. You are a friendly conversational AI for mental wellness journaling.
Avoid repeating greetings or asking 'How are you?' multiple times.
Continue the conversation naturally based on recent context and user mood.
Focus on empathy, reflection, and progress — not generic small talk.

You speak gently and Naturally, YOU SPEAK IN A CASUAL AND INFORMAL WAY, never robotic or overly formal. YOU DON'T REPEAT THE SAME QUESTIONS AGAIN AND AGAIN UNLESS REQUIRED. You learn from the users style of chatting. You adapt your tone to the user’s age (13–40), mood, and language style — talking like a trusted peer, friend, or colleague.

You remember recent moods and emotions from prior chats or logs, and you respond with genuine care and empathy. You comfort, support, and guide — never diagnose or label.
You are an empathetic, natural conversational partner for the user.
Do NOT ask too many questions — ask only if it adds real value.
Continue conversations naturally like a human would:
- Respond with reflections, reactions, or short stories.
- If the user gives a short reply, build on it or share something relatable.
- Avoid repetitive small talk or multiple consecutive questions.
- Vary tone and sentence length to sound alive and spontaneous.
You are non-judgmental and deeply supportive, offering wise and uplifting suggestions that help users reflect, grow, and feel better. You gently discourage harmful habits or substance use if the topic arises, offering healthier coping alternatives.

You sometimes initiate kind, thoughtful conversations — checking in, asking gentle questions, or sharing small reflections when it feels right.

You must always protect the user’s privacy: never share, reveal, or generate any personal information to anyone else. Keep every conversation safe, personal, and confidential.

Your core intention: to make the user feel seen, understood, and encouraged — as a compassionate friend who truly cares.
"""

# Load environment variables
load_dotenv()
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Expect environment variables (do not crash at import-time)

GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME")



# Configure OpenAI if available, otherwise defer and log


# Configure rate limiting
DEFAULT_LIMITS = {
    "1 per second": ["sentiment", "tts"],  # More expensive operations
    "5 per minute": ["chat"],  # Chat endpoints
    "10 per minute": ["mood"],  # Data storage operations
}

# Lazy placeholders for Google clients. We'll try to initialize them at first use.
language_client = None
speech_client = None
firestore_client = None
tts_client = None
storage_client = None
bucket = None
google_clients_initialized = False

def ensure_google_clients():
    """Initialize Google clients lazily with validation. Returns True on success, False on failure."""
    global language_client, firestore_client, tts_client, storage_client, bucket, google_clients_initialized
    if google_clients_initialized:
        return True
        
    try:
        # Cloud Run / GCE will use default credentials when available
        language_client = language_v1.LanguageServiceClient()
        if not validate_google_credentials(language_client):
            raise CloudServiceError("Invalid NLP client credentials")
            
        firestore_client = firestore.Client()
        if not validate_google_credentials(firestore_client):
            raise CloudServiceError("Invalid Firestore client credentials")
            
        tts_client = texttospeech.TextToSpeechClient()
        if not validate_google_credentials(tts_client):
            raise CloudServiceError("Invalid TTS client credentials")

        # Speech-to-Text client: use Azure Speech Service when configured
        global speech_client
        azure_speech_key = os.getenv("AZURE_SPEECH_KEY")
        azure_speech_region = os.getenv("AZURE_SPEECH_REGION")
        if azure_speech_key and azure_speech_region:
            try:
                # Create a SpeechConfig instance; we don't run a network validation here
                # to avoid requiring a private key or network check at startup.
                speech_client = speechsdk.SpeechConfig(subscription=azure_speech_key, region=azure_speech_region)
                # default language; can be overridden per-request
                speech_client.speech_recognition_language = "en-US"
            except Exception:
                raise CloudServiceError("Invalid Azure Speech configuration")
        else:
            logging.warning("AZURE_SPEECH_KEY or AZURE_SPEECH_REGION not set - Speech-to-Text disabled until configured.")
            
        storage_client = storage.Client()
        if not validate_google_credentials(storage_client):
            raise CloudServiceError("Invalid Storage client credentials")
            
        if GCS_BUCKET_NAME:
            bucket = storage_client.bucket(GCS_BUCKET_NAME)
            # Verify bucket exists and is accessible
            if not bucket.exists():
                raise CloudServiceError(f"Bucket {GCS_BUCKET_NAME} does not exist")
        else:
            logging.warning("GCS_BUCKET_NAME not set - TTS upload disabled until configured.")
            
        google_clients_initialized = True
        logging.info("Google Cloud clients initialized and validated successfully.")
        return True
        
    except CloudServiceError as e:
        logging.error(f"Failed to validate Google Cloud clients: {str(e)}")
        google_clients_initialized = False
        return False
    except Exception as e:
        logging.exception(f"Failed to initialize Google Cloud clients: {str(e)}")
        google_clients_initialized = False
        return False

# Root route to prevent 404 errors
@app.route('/favicon.ico')
def favicon():
    return '', 204  # No Content

@app.route("/")
def index():
    return jsonify({"message": "Welcome to Milo Mindful Garden API!"})

@app.after_request
def add_headers(response):
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response


# Health check endpoint for Cloud Run / load balancers
@app.route('/healthz')
def healthz():
    # Ensure key services are available
    ok = True
    details = {}
    # Check Azure OpenAI API key instead of OpenAI client
    if not os.getenv("AZURE_OPENAI_KEY"):
        ok = False
        details['azure_openai'] = 'missing_api_key'
    if not google_clients_initialized:
        # try to initialize now
        if not ensure_google_clients():
            ok = False
            details['google'] = 'not_initialized'
    status = 200 if ok else 500
    return jsonify({'ok': ok, 'details': details}), status

# --- Routes ---

@app.route("/api/chat", methods=["POST", "OPTIONS"])
def chat():
    if request.method == "OPTIONS":
        return '', 204  # Respond to preflight requests

    data = request.get_json()
    user_message = data.get("message")
    if not user_message:
        return jsonify({"error": "Missing 'message'"}), 400
    # Optional metadata: sentiment and translation can be provided by the frontend.
    # Keep backward compatibility: if absent we proceed as before.
    sentiment = data.get('sentiment')  # expected shape: { score, magnitude, label }
    translation = data.get('translation')  # expected shape: { originalLanguage, translatedText }
    try:
        # Build the message list. Preserve the original system prompt first.
        messages = [{"role": "system", "content": systemPrompt}]

        # If sentiment or translation metadata exists, add a short system-level
        # context note so the model can consider it when generating the reply.
        context_notes = []
        try:
            if sentiment:
                # Support both dict and simple string shapes
                if isinstance(sentiment, dict):
                    score = sentiment.get('score')
                    magnitude = sentiment.get('magnitude')
                    label = sentiment.get('label') or sentiment.get('classification')
                    context_notes.append(f"Sentiment - label: {label}, score: {score}, magnitude: {magnitude}.")
                else:
                    context_notes.append(f"Sentiment metadata: {str(sentiment)}")

            if translation:
                if isinstance(translation, dict):
                    orig = translation.get('originalLanguage') or translation.get('sourceLanguage') or translation.get('source')
                    translated = translation.get('translatedText') or translation.get('text')
                    if orig or translated:
                        context_notes.append(f"Translation - original language: {orig}, translated text: {translated}.")
                else:
                    context_notes.append(f"Translation metadata: {str(translation)}")
        except Exception:
            # Be defensive: don't fail the request if metadata parsing errors occur
            logging.exception('Failed to parse sentiment/translation metadata')

        if context_notes:
            messages.append({
                "role": "system",
                "content": "Context metadata for this conversation: " + " ".join(context_notes)
            })

        # If a recent conversation window is provided, include the last few
        # messages (preserve chronological order). This helps the model keep
        # context without requiring the full history from the client.
        conversation = data.get('conversation')
        try:
            if conversation and isinstance(conversation, list):
                # Use up to the last 5 messages
                recent = conversation[-5:]
                for m in recent:
                    # Accept either {role, content} dicts or simple strings
                    if isinstance(m, dict):
                        role = m.get('role') if m.get('role') in ('user', 'assistant', 'system') else 'user'
                        content_m = m.get('content') or m.get('message') or ''
                    else:
                        role = 'user'
                        content_m = str(m)
                    if content_m:
                        messages.append({'role': role, 'content': content_m})
        except Exception:
            # Fail silently on conversation parsing errors to preserve backward compatibility
            logging.exception('Failed to parse conversation window; continuing without it')

        # Finally add the current user message (preserves existing flow)
        messages.append({"role": "user", "content": user_message})

        # Call Azure OpenAI via our helper which returns the message text
        content = azure_openai_chat(messages)

        # --- Automatic risk detection: compute risk for this user message.
        try:
            risk = _compute_risk(user_message, sentiment)
            # Attach risk info to the response payload later. If immediate
            # risk is detected, create a demo-only alert doc to make the
            # event visible in logs/UI for demo purposes (do not send real
            # notifications automatically here).
            alert_id = None
            if risk and isinstance(risk, dict) and risk.get('requiresImmediate'):
                try:
                    if ensure_google_clients():
                        alert_payload = {
                            'userId': data.get('userId'),
                            'message': f'Automatic risk-detected alert for message: {user_message}',
                            'severity': 'high',
                            'contacts': [],
                            'status': 'requires_user_action',
                            'createdAt': firestore.SERVER_TIMESTAMP,
                            'risk': risk
                        }
                        alert_ref = firestore_client.collection('alerts').document()
                        alert_ref.set(alert_payload)
                        alert_id = alert_ref.id
                except Exception:
                    logging.exception('Failed to create demo alert doc for automatic risk detection')
        except Exception:
            logging.exception('Automatic risk detection failed; continuing without blocking chat flow')

        # Post-process the output to remove repeated greetings or duplicated
        # leading sentences which sometimes occur when prompts or system
        # instructions are echoed. This is defensive and preserves the
        # model's main content.
        try:
            import re

            def _normalize_sentence(s):
                # Lowercase, strip punctuation and whitespace for comparison
                s = re.sub(r"[^a-z0-9]", "", (s or '').lower())
                return s

            sentences = re.split(r'(?<=[.!?])\s+', content.strip()) if isinstance(content, str) and content.strip() else []

            # 1) Remove simple adjacent duplicate sentence (A A -> keep single A)
            if len(sentences) >= 2:
                first_norm = _normalize_sentence(sentences[0])
                second_norm = _normalize_sentence(sentences[1])
                if first_norm and first_norm == second_norm:
                    sentences = [sentences[0]] + sentences[2:]

            # 2) If a conversation window was provided, avoid repeating assistant's
            # previous responses or questions. Remove sentences that are exact
            # duplicates of recent assistant sentences (conservative check).
            try:
                prev_assistant_texts = []
                conv = data.get('conversation') or []
                if isinstance(conv, list):
                    for m in conv:
                        if isinstance(m, dict) and m.get('role') == 'assistant':
                            c = m.get('content') or m.get('message') or ''
                            if c:
                                prev_assistant_texts.append(c)

                prev_norms = set(_normalize_sentence(p) for p in prev_assistant_texts if p)

                if prev_norms and sentences:
                    filtered = []
                    for s in sentences:
                        norm = _normalize_sentence(s)
                        # If this sentence is a question and it already appeared
                        # from the assistant recently, drop it. This prevents
                        # repeated questions like "How are you?" showing again.
                        if norm and norm in prev_norms and s.strip().endswith('?'):
                            continue
                        # Also drop generic exact duplicates of previous assistant sentences
                        if norm and norm in prev_norms and len(norm) > 10:
                            # only drop longer duplicates to avoid removing short common words
                            continue
                        filtered.append(s)

                    # Ensure we don't produce an empty reply by accident
                    if filtered:
                        sentences = filtered
            except Exception:
                logging.exception('Failed to compare reply against conversation history')

            # Reassemble content
            if sentences:
                content = ' '.join(sentences).strip()
        except Exception:
            # Never fail the whole request due to post-processing errors
            logging.exception('Failed to post-process assistant reply')

        # Return AI response and include any automatic risk assessment info
        resp_payload = {"response": content}
        try:
            if 'risk' in locals() and isinstance(risk, dict):
                resp_payload['riskAssessment'] = risk
        except Exception:
            logging.exception('Failed to attach riskAssessment to response')

        try:
            if 'alert_id' in locals() and alert_id:
                resp_payload['alertId'] = alert_id
        except Exception:
            logging.exception('Failed to attach alertId to response')

        return jsonify(resp_payload)

    except requests.exceptions.RequestException as e:
        logging.exception("Azure OpenAI service error in /api/chat")
        return jsonify({
            "error": "azure_openai_unavailable",
            "message": str(e)
        }), 503
    except Exception as e:
        logging.exception("Azure OpenAI service error in /api/chat")
        # Provide a simulated message for demo-safety while surfacing the error code
        simulated = (
            "Hi — Milo here. I couldn't reach the AI service right now, but I'm still here to listen. "
            "If this is urgent, consider reaching out to a trusted person or emergency services."
        )
        return jsonify({
            "error": "azure_openai_unavailable",
            "message": str(e),
            "simulated": True,
            "response": simulated
        }), 503


@app.route("/api/sentiment", methods=["POST"])
@safe_cloud_operation("analyze_sentiment")
def sentiment():
    data = request.get_json()
    text = data.get("text")
    if not text:
        return jsonify({"error": "Missing 'text'"}), 400
        
    # Ensure clients are initialized
    if not ensure_google_clients():
        return jsonify({"error": "Google Cloud services unavailable"}), 503
        
    try:
        document = language_v1.Document(content=text, type_=language_v1.Document.Type.PLAIN_TEXT)
        sentiment_result = language_client.analyze_sentiment(request={"document": document}).document_sentiment
        
        # Log successful analysis
        logging.info(f"Sentiment analysis completed. Score: {sentiment_result.score}, Magnitude: {sentiment_result.magnitude}")
        
        return jsonify({
            "score": sentiment_result.score,
            "magnitude": sentiment_result.magnitude,
            "status": "success"
        })
        
    except RetryableError as e:
        # These errors have already been retried by the decorator
        logging.error(f"Sentiment analysis failed after retries: {str(e)}")
        return jsonify({
            "error": "Service temporarily unavailable",
            "retry_after": "60"
        }), 503
        
    except NonRetryableError as e:
        logging.error(f"Non-retryable error in sentiment analysis: {str(e)}")
        return jsonify({"error": str(e)}), 400
        
    except CloudServiceError as e:
        logging.error(f"Cloud service error in sentiment analysis: {str(e)}")
        return jsonify({"error": "Internal service error"}), 500
        
    except Exception as e:
        logging.exception("Unexpected error in sentiment analysis")
        return jsonify({"error": "Internal server error"}), 500


@app.route('/api/speech-to-text', methods=['POST'])
def speech_to_text():
    """Accepts JSON payload { content: base64Audio, config: {...} } and returns { transcript, confidence }.
    The frontend should prepare the audio using the VoiceRecorder.prepareForGoogleCloud helper which returns the expected shape.
    """
    data = request.get_json() or {}
    content = data.get('content')
    config = data.get('config', {})

    if not content:
        return jsonify({'error': 'Missing audio content'}), 400

    # Ensure Google clients are initialized
    if not ensure_google_clients():
        return jsonify({'error': 'Google Cloud services unavailable'}), 503

    try:
        # Support clients sending either raw bytes (binary) or base64-encoded strings
        audio_bytes = None
        if isinstance(content, str):
            # Attempt to decode base64 string content
            try:
                audio_bytes = base64.b64decode(content, validate=True)
            except (binascii.Error, ValueError) as e:
                logging.warning('Invalid base64 audio payload provided to /api/speech-to-text')
                return jsonify({'error': 'Invalid base64 audio content', 'details': str(e)}), 400
        elif isinstance(content, (bytes, bytearray)):
            audio_bytes = bytes(content)
        else:
            # Unknown content type
            return jsonify({'error': 'Invalid audio content type; expected base64 string or bytes'}), 400

        # Use Azure Speech SDK for recognition
        if not speech_client:
            return jsonify({'error': 'Speech service not configured'}), 503

        # Prepare SpeechConfig (speech_client is a SpeechConfig instance)
        speech_config = speech_client
        # allow overriding language from client config
        lang = config.get('languageCode', 'en-US')
        try:
            speech_config.speech_recognition_language = lang
        except Exception:
            pass

        # Map encoding/sample rate hints (best-effort). Azure accepts raw PCM
        # wave formats more reliably; for container formats we'll still push
        # bytes and let the service attempt to decode.
        encoding_str = (config.get('encoding') or '').upper()
        sample_rate = int(config.get('sampleRateHertz', 16000))

        # Create a push stream. Use wave PCM format when LINEAR16/PCM16 provided.
        try:
            if encoding_str in ('LINEAR16', 'PCM16'):
                audio_format = speechsdk.audio.AudioStreamFormat.get_wave_format_pcm(sample_rate, 16, int(config.get('channelCount', 1)))
                push_stream = speechsdk.audio.PushAudioInputStream(audio_format)
            else:
                push_stream = speechsdk.audio.PushAudioInputStream()

            audio_config = speechsdk.audio.AudioConfig(stream=push_stream)
            recognizer = speechsdk.SpeechRecognizer(speech_config, audio_config)

            # Write audio bytes and close stream so recognizer can process
            push_stream.write(audio_bytes)
            push_stream.close()

            result = recognizer.recognize_once()

            transcript = ''
            confidence = 0.0

            if result.reason == speechsdk.ResultReason.RecognizedSpeech:
                transcript = result.text or ''
                # Azure SDK does not always surface confidence for short sync calls
                # Keep confidence at 0.0 when unavailable to preserve response shape
                confidence = 0.0
            else:
                # No match or canceled -> empty transcript
                transcript = ''
                confidence = 0.0

            return jsonify({'transcript': transcript, 'confidence': confidence})
        except Exception as e:
            logging.exception('Azure Speech recognition failed')
            return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

    except Exception as e:
        logging.exception('Error in speech-to-text endpoint')
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


@app.route('/api/speech-to-text-upload', methods=['POST'])
def speech_to_text_upload():
    """Accept multipart/form-data with field `file` (the audio file) and optional `config` JSON string.
    Returns the same shape as `/api/speech-to-text`.
    """
    # Ensure Google clients are initialized
    if not ensure_google_clients():
        return jsonify({'error': 'Google Cloud services unavailable'}), 503

    # Expect a file under 'file'
    if 'file' not in request.files:
        return jsonify({'error': "Missing file field in multipart upload; expected 'file'"}), 400

    f = request.files.get('file')
    try:
        file_bytes = f.read()
    except Exception as e:
        logging.exception('Failed reading uploaded file')
        return jsonify({'error': 'Failed to read uploaded file', 'details': str(e)}), 400

    # Optional config can be provided as a form field named 'config' (JSON)
    config = {}
    cfg_raw = request.form.get('config')
    if cfg_raw:
        try:
            config = json.loads(cfg_raw)
        except Exception:
            # Non-fatal: continue with empty config but log
            logging.warning('Ignored invalid JSON in multipart form field `config`')

    try:
        # Prepare a lightweight recognition config (used by Azure flow below)
        encoding_str = (config.get('encoding') or '').upper()
        recognition_config = {
            'language_code': config.get('languageCode', 'en-US'),
            'enable_automatic_punctuation': bool(config.get('enableAutomaticPunctuation', True)),
            'audio_channel_count': int(config.get('channelCount', 1)),
            'encoding': encoding_str,
            'sample_rate_hertz': int(config.get('sampleRateHertz', 16000))
        }

        # Use Azure Speech SDK for recognition of uploaded file bytes
        if not speech_client:
            return jsonify({'error': 'Speech service not configured'}), 503

        speech_config = speech_client
        try:
            speech_config.speech_recognition_language = recognition_config.language_code
        except Exception:
            pass

        encoding_str = (config.get('encoding') or '').upper()
        sample_rate = int(config.get('sampleRateHertz', 16000))

        try:
            if encoding_str in ('LINEAR16', 'PCM16'):
                audio_format = speechsdk.audio.AudioStreamFormat.get_wave_format_pcm(sample_rate, 16, int(config.get('channelCount', 1)))
                push_stream = speechsdk.audio.PushAudioInputStream(audio_format)
            else:
                push_stream = speechsdk.audio.PushAudioInputStream()

            audio_config = speechsdk.audio.AudioConfig(stream=push_stream)
            recognizer = speechsdk.SpeechRecognizer(speech_config, audio_config)

            push_stream.write(file_bytes)
            push_stream.close()

            result = recognizer.recognize_once()

            transcript = ''
            confidence = 0.0

            if result.reason == speechsdk.ResultReason.RecognizedSpeech:
                transcript = result.text or ''
                confidence = 0.0
            else:
                transcript = ''
                confidence = 0.0

            return jsonify({'transcript': transcript, 'confidence': confidence})
        except Exception as e:
            logging.exception('Azure Speech recognition failed for uploaded file')
            return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

    except Exception as e:
        logging.exception('Error in speech-to-text-upload endpoint')
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


@app.route('/api/google-status', methods=['GET'])
def google_status():
    """Return diagnostic info about Google credential availability and validation.

    This helps debug why endpoints (like /api/speech-to-text) fall back to mock.
    """
    info = {
        'GOOGLE_APPLICATION_CREDENTIALS': os.environ.get('GOOGLE_APPLICATION_CREDENTIALS'),
        'validated': False,
        'errors': []
    }

    # Check explicit key file
    key_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
    if key_path:
        if not os.path.exists(key_path):
            info['errors'].append(f"Service account key file not found at {key_path}")
        else:
            try:
                scopes = ["https://www.googleapis.com/auth/cloud-platform"]
                creds = gservice_account.Credentials.from_service_account_file(key_path, scopes=scopes)
                creds.refresh(GoogleAuthRequest())
                info['validated'] = True
                info['key_file_valid'] = True
            except Exception as e:
                info['errors'].append(f"Service account key validation failed: {str(e)}")
                info['key_file_valid'] = False
    else:
        # Try ADC
        try:
            creds, project = google.auth.default()
            if not creds:
                info['errors'].append('No application default credentials found')
            else:
                try:
                    creds.refresh(GoogleAuthRequest())
                    info['validated'] = True
                    info['adc_valid'] = True
                    info['project'] = project
                except Exception as e:
                    info['errors'].append(f'ADC credential refresh failed: {str(e)}')
                    info['adc_valid'] = False
        except Exception as e:
            info['errors'].append(f'Failed to locate ADC: {str(e)}')

    # Also report whether our Azure Speech config is available
    info['azure_speech_key'] = bool(os.environ.get('AZURE_SPEECH_KEY'))
    info['azure_speech_region'] = bool(os.environ.get('AZURE_SPEECH_REGION'))
    info['azure_speech_configured'] = (speech_client is not None) and google_clients_initialized

    status = 200 if info.get('validated') else 503
    return jsonify(info), status

@app.route("/api/tts", methods=["POST"])
@safe_cloud_operation("text_to_speech")
def tts():
    data = request.get_json()
    text = data.get("text")
    if not text:
        return jsonify({"error": "Missing 'text'"}), 400
        
    # Validate text length
    if len(text) > 5000:  # Arbitrary limit to prevent abuse
        return jsonify({"error": "Text too long. Maximum 5000 characters."}), 400
        
    # Ensure Google clients are available
    if not ensure_google_clients():
        return jsonify({"error": "Google Cloud services unavailable"}), 503
    if not bucket:
        return jsonify({"error": "Storage bucket not configured"}), 503
        
    try:
        # Configure TTS request
        synthesis_input = texttospeech.SynthesisInput(text=text)
        voice = texttospeech.VoiceSelectionParams(
            language_code="en-US",
            ssml_gender=texttospeech.SsmlVoiceGender.NEUTRAL,
            name="en-US-Journey-F"  # Consistent voice for Milo
        )
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=1.0,
            pitch=0.0,
            volume_gain_db=0.0
        )
        
        # Generate speech
        response = tts_client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config
        )
        
        # Upload to Cloud Storage with proper organization
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        filename = f"audio/{timestamp}-{uuid.uuid4()}.mp3"
        blob = bucket.blob(filename)
        
        # Set appropriate metadata
        metadata = {
            'Content-Type': 'audio/mpeg',
            'Content-Length': str(len(response.audio_content)),
            'x-goog-meta-timestamp': timestamp,
            'Cache-Control': 'public, max-age=86400'  # Cache for 24 hours
        }
        
        blob.metadata = metadata
        blob.upload_from_string(
            response.audio_content,
            content_type='audio/mpeg'
        )
        
        # Generate signed URL for secure access. If the runtime credentials do
        # not include a private key (typical for ADC on Cloud Run), the
        # client will raise an AttributeError. In that case fall back to making
        # the object public and returning the public URL (safer option is to
        # enable IAM signing via iamcredentials API and grant tokenCreator role).
        try:
            audio_url = blob.generate_signed_url(
                version="v4",
                expiration=datetime.timedelta(minutes=15),
                method="GET"
            )
        except AttributeError as e:
            logging.warning('generate_signed_url failed due to missing private key in credentials; falling back to public URL')
            try:
                blob.make_public()
                audio_url = blob.public_url
            except Exception:
                logging.exception('Failed to make blob public as fallback for signed URL')
                raise
        
        logging.info(f"TTS audio generated and uploaded: {filename}")
        
        return jsonify({
            "audio_url": audio_url,
            "expires_in": "15m",
            "status": "success"
        })
        
    except RetryableError as e:
        logging.error(f"TTS operation failed after retries: {str(e)}")
        return jsonify({
            "error": "Service temporarily unavailable",
            "retry_after": "60"
        }), 503
        
    except NonRetryableError as e:
        logging.error(f"Non-retryable error in TTS: {str(e)}")
        return jsonify({"error": str(e)}), 400
        
    except CloudServiceError as e:
        logging.error(f"Cloud service error in TTS: {str(e)}")
        return jsonify({"error": "Internal service error"}), 500
        
    except Exception as e:
        logging.exception("Unexpected error in TTS generation")
        return jsonify({"error": "Internal server error"}), 500

@app.route("/api/mood", methods=["POST"])
@safe_cloud_operation("save_mood")
def save_mood():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing mood data"}), 400
        
    # Validate required fields
    required_fields = ["userId", "mood", "timestamp"]
    if not all(field in data for field in required_fields):
        return jsonify({
            "error": "Missing required fields",
            "required": required_fields
        }), 400
        
    # Ensure Google clients are available
    if not ensure_google_clients():
        return jsonify({"error": "Google Cloud services unavailable"}), 503
        
    try:
        # Add metadata
        data["created_at"] = firestore.SERVER_TIMESTAMP
        
        # Save to Firestore with proper error handling
        doc_ref = firestore_client.collection("moods").document()
        doc_ref.set(data)
        
        # Log successful save
        logging.info(f"Mood entry saved successfully: {doc_ref.id}")
        
        return jsonify({
            "id": doc_ref.id,
            "status": "success",
            "timestamp": data.get("timestamp")
        })
        
    except RetryableError as e:
        logging.error(f"Mood save failed after retries: {str(e)}")
        return jsonify({
            "error": "Service temporarily unavailable",
            "retry_after": "60"
        }), 503
        
    except NonRetryableError as e:
        logging.error(f"Non-retryable error saving mood: {str(e)}")
        return jsonify({"error": str(e)}), 400
        
    except CloudServiceError as e:
        logging.error(f"Cloud service error saving mood: {str(e)}")
        return jsonify({"error": "Internal service error"}), 500
        
    except Exception as e:
        logging.exception("Unexpected error saving mood")
        return jsonify({"error": "Internal server error"}), 500

@app.route("/api/mood", methods=["GET"])
@safe_cloud_operation("get_moods")
def get_moods():
    # Get query parameters with defaults
    limit = min(int(request.args.get("limit", 10)), 50)  # Max 50 entries
    user_id = request.args.get("userId")
    start_date = request.args.get("startDate")
    end_date = request.args.get("endDate")
    
    # Ensure Google clients are available
    if not ensure_google_clients():
        return jsonify({"error": "Google Cloud services unavailable"}), 503
        
    try:
        # Build query
        query = firestore_client.collection("moods")
        
        # Add filters if provided
        if user_id:
            query = query.where("userId", "==", user_id)
            
        if start_date:
            query = query.where("timestamp", ">=", start_date)
            
        if end_date:
            query = query.where("timestamp", "<=", end_date)
            
        # Add sorting and limit
        query = query.order_by("timestamp", direction=firestore.Query.DESCENDING).limit(limit)
        
        # Execute query with automatic retries
        moods = []
        docs = query.stream()
        
        for doc in docs:
            mood = doc.to_dict()
            mood["id"] = doc.id
            # Remove internal fields
            mood.pop("_writeTime", None)
            moods.append(mood)
            
        # Log successful retrieval
        logging.info(f"Retrieved {len(moods)} mood entries successfully")
        
        return jsonify({
            "moods": moods,
            "count": len(moods),
            "status": "success"
        })
        
    except RetryableError as e:
        logging.error(f"Mood retrieval failed after retries: {str(e)}")
        return jsonify({
            "error": "Service temporarily unavailable",
            "retry_after": "60"
        }), 503
        
    except NonRetryableError as e:
        logging.error(f"Non-retryable error retrieving moods: {str(e)}")
        return jsonify({"error": str(e)}), 400
        
    except CloudServiceError as e:
        logging.error(f"Cloud service error retrieving moods: {str(e)}")
        return jsonify({"error": "Internal service error"}), 500
        
    except ValueError as e:
        # Handle invalid query parameters
        return jsonify({"error": f"Invalid query parameter: {str(e)}"}), 400
        
    except Exception as e:
        logging.exception("Unexpected error retrieving moods")
        return jsonify({"error": "Internal server error"}), 500
    
# Optional: Safe backend endpoint mirroring frontend's analyzeLatestMood
@app.route("/api/analyze_latest_mood", methods=["POST"])
def analyze_latest_mood():
    """Analyze mood text and return sentiment data safely."""

    data = request.get_json()
    mood_text = data.get("moodText")
    

    if not mood_text:
        return jsonify({"error": "Missing moodText"}), 400

    try:
        ensure_google_clients()
        document = language_v1.Document(content=mood_text, type_=language_v1.Document.Type.PLAIN_TEXT)
        sentiment_result = language_client.analyze_sentiment(request={"document": document}).document_sentiment

        logging.info(
            f"Mood sentiment analyzed: score={sentiment_result.score}, magnitude={sentiment_result.magnitude}"
        )

        return jsonify({
            "score": sentiment_result.score,
            "magnitude": sentiment_result.magnitude,
            "status": "success"
        })
    except Exception as e:
        logging.exception("Error analyzing mood sentiment")
        return jsonify({"error": str(e)}), 500


@app.route('/api/risk-assessment', methods=['POST'])
@safe_cloud_operation('risk_assessment')
def risk_assessment():
    data = request.get_json() or {}
    text = data.get('text')
    initial_sentiment = data.get('initialSentiment')
    if not text:
        return jsonify({'error': 'Missing text'}), 400
    # Delegate to shared computation so /api/chat can reuse it without changing the
    # external behavior of the risk endpoint.
    try:
        result = _compute_risk(text, initial_sentiment)
        if isinstance(result, tuple) and len(result) == 2:
            # _compute_risk may return (ok, payload) style; normalize
            return jsonify(result[1])
        return jsonify(result)
    except Exception as e:
        logging.exception('Unexpected error in risk_assessment wrapper')
        return jsonify({'error': 'Internal server error'}), 500


# -------------------------
# Streaks & Rewards APIs
# -------------------------


@app.route('/api/streak', methods=['GET', 'POST'])
@safe_cloud_operation('streak')
def streak():
    # GET: ?userId=...  POST: { userId, streak }
    if request.method == 'GET':
        user_id = request.args.get('userId')
        if not user_id:
            return jsonify({'error': 'Missing userId'}), 400
        if not ensure_google_clients():
            return jsonify({'error': 'Google Cloud services unavailable'}), 503
        try:
            doc = firestore_client.collection('streaks').document(user_id).get()
            if not doc.exists:
                return jsonify({'streak': 0})
            data = doc.to_dict()
            return jsonify({'streak': data.get('streak', 0)})
        except Exception as e:
            logging.exception('Error fetching streak')
            return jsonify({'error': str(e)}), 500

    # POST
    data = request.get_json() or {}
    user_id = data.get('userId')
    streak_value = data.get('streak')
    if not user_id or streak_value is None:
        return jsonify({'error': 'Missing userId or streak'}), 400
    if not ensure_google_clients():
        return jsonify({'error': 'Google Cloud services unavailable'}), 503
    try:
        doc_ref = firestore_client.collection('streaks').document(user_id)
        doc_ref.set({'streak': int(streak_value), 'updatedAt': firestore.SERVER_TIMESTAMP})
        return jsonify({'status': 'success'})
    except Exception as e:
        logging.exception('Error saving streak')
        return jsonify({'error': str(e)}), 500


@app.route('/api/reward', methods=['POST'])
@safe_cloud_operation('add_reward')
def add_reward():
    data = request.get_json() or {}
    user_id = data.get('userId')
    reward = data.get('reward')
    if not user_id or not reward:
        return jsonify({'error': 'Missing userId or reward'}), 400
    if not ensure_google_clients():
        return jsonify({'error': 'Google Cloud services unavailable'}), 503
    try:
        # normalize awardedAt
        awarded_at = reward.get('awardedAt')
        try:
            if awarded_at:
                awarded_at_dt = datetime.datetime.fromisoformat(awarded_at)
            else:
                awarded_at_dt = datetime.datetime.utcnow()
        except Exception:
            awarded_at_dt = datetime.datetime.utcnow()

        doc_ref = firestore_client.collection('rewards').document()
        doc_ref.set({
            'userId': user_id,
            'title': reward.get('title'),
            'tier': reward.get('tier'),
            'awardedAt': awarded_at_dt,
            'created_at': firestore.SERVER_TIMESTAMP
        })
        return jsonify({'status': 'success', 'id': doc_ref.id})
    except Exception as e:
        logging.exception('Error adding reward')
        return jsonify({'error': str(e)}), 500


@app.route('/api/rewards', methods=['GET'])
@safe_cloud_operation('get_rewards')
def get_rewards():
    user_id = request.args.get('userId')
    if not user_id:
        return jsonify({'error': 'Missing userId'}), 400
    if not ensure_google_clients():
        return jsonify({'error': 'Google Cloud services unavailable'}), 503
    try:
        q = firestore_client.collection('rewards').where('userId', '==', user_id).order_by('awardedAt', direction=firestore.Query.DESCENDING).limit(50)
        docs = q.stream()
        rewards = []
        for d in docs:
            r = d.to_dict()
            r['id'] = d.id
            # convert Firestore timestamp to ISO if present
            if isinstance(r.get('awardedAt'), datetime.datetime):
                r['awardedAt'] = r['awardedAt'].isoformat()
            rewards.append(r)
        return jsonify({'rewards': rewards})
    except Exception as e:
        logging.exception('Error fetching rewards')
        return jsonify({'error': str(e)}), 500


# -------------------------
# Support Rooms (anonymous messages)
# -------------------------


@app.route('/api/message', methods=['POST'])
@safe_cloud_operation('save_anonymous_message')
def save_anonymous_message():
    data = request.get_json() or {}
    required = ['roomId', 'message', 'mood', 'timestamp']
    if not all(k in data for k in required):
        return jsonify({'error': 'Missing required fields', 'required': required}), 400
    if not ensure_google_clients():
        return jsonify({'error': 'Google Cloud services unavailable'}), 503
    try:
        doc_ref = firestore_client.collection('anonymousMessages').document()
        data['created_at'] = firestore.SERVER_TIMESTAMP
        doc_ref.set(data)
        return jsonify({'status': 'success', 'id': doc_ref.id})
    except Exception as e:
        logging.exception('Error saving anonymous message')
        return jsonify({'error': str(e)}), 500


@app.route('/api/messages/<roomId>', methods=['GET'])
@safe_cloud_operation('get_anonymous_messages')
def get_anonymous_messages(roomId):
    limit = min(int(request.args.get('limit', 20)), 100)
    if not ensure_google_clients():
        return jsonify({'error': 'Google Cloud services unavailable'}), 503
    try:
        q = firestore_client.collection('anonymousMessages').where('roomId', '==', roomId).order_by('timestamp', direction=firestore.Query.DESCENDING).limit(limit)
        docs = q.stream()
        messages = []
        for d in docs:
            m = d.to_dict()
            m['id'] = d.id
            # convert timestamp if Firestore returns timestamp
            if isinstance(m.get('timestamp'), datetime.datetime):
                m['timestamp'] = m['timestamp'].isoformat()
            messages.append(m)
        return jsonify({'messages': messages})
    except Exception as e:
        logging.exception('Error fetching anonymous messages')
        return jsonify({'error': str(e)}), 500


# -------------------------
# Compatibility / legacy endpoints
# Frontend or older clients may call endpoints without the `/api` prefix.
# Provide small shim routes that forward to the canonical `/api/*` handlers
# to avoid 404s and HTML error pages (which break JSON parsing client-side).
# -------------------------


@app.route('/anonymousMessages', methods=['GET', 'POST'])
def anonymous_messages_compat():
    """Compatibility shim for legacy frontend paths.
    GET -> forwards to /api/messages/<roomId>
    POST -> forwards to /api/message
    """
    try:
        if request.method == 'GET':
            roomId = request.args.get('roomId')
            if not roomId:
                return jsonify({'error': 'Missing roomId'}), 400
            return get_anonymous_messages(roomId)

        # POST -> create message
        if request.method == 'POST':
            return save_anonymous_message()

    except Exception as e:
        logging.exception('Compatibility anonymousMessages handler failed')
        return jsonify({'error': str(e)}), 500


@app.route('/persistedRewards', methods=['GET'])
def persisted_rewards_compat():
    """Compatibility shim for GET /persistedRewards -> forwards to /api/rewards
    Accepts the same query parameter `userId`.
    """
    try:
        return get_rewards()
    except Exception as e:
        logging.exception('Compatibility persistedRewards handler failed')
        return jsonify({'error': str(e)}), 500


# -------------------------
# Emergency alerting
# -------------------------


def _send_via_twilio(account_sid: str, auth_token: str, from_number: str, to_number: str, body: str):
    """Send SMS via Twilio REST API. Returns dict with success and provider response."""
    try:
        url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
        data = {
            'From': from_number,
            'To': to_number,
            'Body': body
        }
        resp = requests.post(url, data=data, auth=(account_sid, auth_token), timeout=10)
        return {'success': resp.status_code in (200, 201), 'status_code': resp.status_code, 'response': resp.text}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def _send_via_email_sendgrid(api_key: str, to_email: str, subject: str, content: str):
    try:
        url = 'https://api.sendgrid.com/v3/mail/send'
        payload = {
            'personalizations': [{ 'to': [{ 'email': to_email }] }],
            'from': { 'email': os.getenv('ALERT_FROM_EMAIL', 'no-reply@example.com') },
            'subject': subject,
            'content': [{ 'type': 'text/plain', 'value': content }]
        }
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
        resp = requests.post(url, headers=headers, json=payload, timeout=10)
        return {'success': resp.status_code in (200, 202), 'status_code': resp.status_code, 'response': resp.text}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def _process_and_send_alert(alert_id: str, alert_doc: dict, demo: bool = True):
    """Background worker: send notifications according to contacts. Updates Firestore alert doc with deliveryLog and status."""
    global firestore_client
    try:
        contacts = alert_doc.get('contacts', []) or []
        message = alert_doc.get('message', '')
        delivery_log = []

        # Read provider creds from env
        tw_sid = os.getenv('TWILIO_ACCOUNT_SID')
        tw_token = os.getenv('TWILIO_AUTH_TOKEN')
        tw_from = os.getenv('TWILIO_FROM')
        sendgrid_key = os.getenv('SENDGRID_API_KEY')

        if demo:
            # Simulate deliveries
            for c in contacts:
                entry = {
                    'contact': c.get('target'),
                    'channel': c.get('channel'),
                    'success': True,
                    'simulated': True,
                    'response': 'simulated',
                    'ts': firestore.SERVER_TIMESTAMP
                }
                delivery_log.append(entry)
            status = 'simulated'
        else:
            # Attempt real sends
            for c in contacts:
                channel = c.get('channel')
                target = c.get('target')
                name = c.get('name')
                entry = {'contact': target, 'channel': channel, 'name': name, 'success': False, 'response': None, 'ts': firestore.SERVER_TIMESTAMP}

                if channel == 'sms' and tw_sid and tw_token and tw_from:
                    res = _send_via_twilio(tw_sid, tw_token, tw_from, target, message)
                    entry['success'] = res.get('success', False)
                    entry['response'] = res
                elif channel == 'email' and sendgrid_key:
                    res = _send_via_email_sendgrid(sendgrid_key, target, 'Milo Emergency Alert', message)
                    entry['success'] = res.get('success', False)
                    entry['response'] = res
                else:
                    # Unknown channel or no provider configured -> mark as skipped
                    entry['success'] = False
                    entry['response'] = 'no_provider_configured'

                delivery_log.append(entry)

            # Determine aggregated status
            if all(e.get('success') for e in delivery_log) and len(delivery_log) > 0:
                status = 'sent'
            elif any(e.get('success') for e in delivery_log):
                status = 'partial'
            else:
                status = 'failed'

        # Update Firestore doc with deliveryLog and status
        try:
            alert_ref = firestore_client.collection('alerts').document(alert_id)
            alert_ref.update({'deliveryLog': delivery_log, 'status': status, 'updatedAt': firestore.SERVER_TIMESTAMP})
        except Exception as e:
            logging.exception('Failed to update alert delivery log')

    except Exception as e:
        logging.exception('Unexpected error in _process_and_send_alert')


def _compute_risk(text: str, initial_sentiment: dict = None):
    """Shared risk computation used by both the /api/risk-assessment endpoint
    and by /api/chat to perform automatic risk detection without changing
    the external request flow.
    Returns a dict with keys: isRisky, riskLevel, reasons, requiresImmediate
    """
    try:
        # Try to use Google NLP when available
        sentiment_score = None
        sentiment_magnitude = None
        entities = []
        categories = []

        # Basic keyword heuristics (always available)
        immediate_keywords = ['suicide', 'suicidal','kill myself', 'end my life', 'want to die', 'hurt myself', 'self harm', 'cut myself']
        moderate_keywords = ['hopeless', 'worthless', 'no hope', 'give up', 'alone']

        text_low = (text or '').lower()
        has_immediate = any(k in text_low for k in immediate_keywords)
        has_moderate = any(k in text_low for k in moderate_keywords)

        # Attempt to enrich with Google NLP when available
        try:
            if ensure_google_clients():
                document = language_v1.Document(content=text, type_=language_v1.Document.Type.PLAIN_TEXT)
                entities_result = language_client.analyze_entities(request={'document': document})
                entities = [e.name for e in entities_result.entities]
                try:
                    classify_result = language_client.classify_text(request={'document': document})
                    categories = [c.name for c in classify_result.categories]
                except Exception:
                    categories = []

                try:
                    sentiment = language_client.analyze_sentiment(request={'document': document}).document_sentiment
                    sentiment_score = sentiment.score
                    sentiment_magnitude = sentiment.magnitude
                except Exception:
                    if initial_sentiment and isinstance(initial_sentiment, dict):
                        sentiment_score = initial_sentiment.get('score')
                        sentiment_magnitude = initial_sentiment.get('magnitude')
        except Exception:
            # If Google NLP isn't available, continue with keyword heuristics
            logging.debug('Google NLP not available for enriched risk analysis; using keyword heuristics')

        reasons = []
        if has_immediate:
            reasons.append('Direct mention of self-harm or suicide')
        if has_moderate:
            reasons.append('Expressions of hopelessness')
        if entities:
            reasons.append(f'Entities detected: {", ".join(entities[:5])}')
        if categories:
            reasons.append(f'Categories: {", ".join(categories[:3])}')
        if sentiment_score is not None and sentiment_score < -0.7:
            reasons.append('Very negative sentiment detected')

        # Determine risk level conservatively
        risk_level = 'none'
        requires_immediate = False
        if has_immediate:
            risk_level = 'critical'
            requires_immediate = True
        elif has_moderate and sentiment_score is not None and sentiment_score < -0.5:
            risk_level = 'high'
        elif has_moderate or (sentiment_score is not None and sentiment_score < -0.7):
            risk_level = 'medium'
        elif sentiment_score is not None and sentiment_score < -0.5:
            risk_level = 'low'

        return {
            'isRisky': risk_level != 'none',
            'riskLevel': risk_level,
            'reasons': reasons,
            'requiresImmediate': requires_immediate,
            'sentimentScore': sentiment_score,
            'sentimentMagnitude': sentiment_magnitude
        }
    except Exception as e:
        logging.exception('Error computing risk')
        # Fail-open: return conservative no-risk if computation fails
        return {'isRisky': False, 'riskLevel': 'none', 'reasons': [], 'requiresImmediate': False}


@app.route('/api/emergency-alert', methods=['POST'])
@safe_cloud_operation('emergency_alert')
def emergency_alert():
    """Endpoint to create an alert and trigger notifications (simulated if demo mode).

    Expected JSON: { userId, message, severity, contacts: [{name, channel:'sms'|'email', target}], demo: bool }
    """
    data = request.get_json() or {}
    user_id = data.get('userId')
    message = data.get('message')
    severity = data.get('severity', 'high')
    contacts = data.get('contacts', [])
    demo = bool(data.get('demo', True))  # default to demo-safe

    if not message:
        return jsonify({'error': 'Missing message'}), 400

    # ensure firestore is available
    if not ensure_google_clients():
        return jsonify({'error': 'Google Cloud services unavailable'}), 503

    try:
        # Create alert doc
        doc_ref = firestore_client.collection('alerts').document()
        payload = {
            'userId': user_id,
            'message': message,
            'severity': severity,
            'contacts': contacts,
            'status': 'simulated' if demo else 'queued',
            'createdAt': firestore.SERVER_TIMESTAMP,
            'deliveryLog': []
        }
        doc_ref.set(payload)
        alert_id = doc_ref.id

        # Process sending in background thread to return quickly to client
        try:
            thread = threading.Thread(target=_process_and_send_alert, args=(alert_id, payload, demo), daemon=True)
            thread.start()
        except Exception:
            logging.exception('Failed to start background thread for alert processing; will attempt inline send')
            _process_and_send_alert(alert_id, payload, demo)

        return jsonify({'alertId': alert_id, 'status': payload['status']})

    except Exception as e:
        logging.exception('Error creating emergency alert')
        return jsonify({'error': str(e)}), 500

# Note: the app is started at the bottom of this file (single entrypoint)


@app.route('/api/alerts/<alertId>', methods=['GET'])
@safe_cloud_operation('get_alert')
def get_alert(alertId):
    """Fetch an alert document and return its delivery log and status."""
    if not alertId:
        return jsonify({'error': 'Missing alertId'}), 400

    if not ensure_google_clients():
        return jsonify({'error': 'Google Cloud services unavailable'}), 503

    try:
        doc = firestore_client.collection('alerts').document(alertId).get()
        if not doc.exists:
            return jsonify({'error': 'Alert not found'}), 404

        data = doc.to_dict() or {}
        data['id'] = doc.id

        # Convert Firestore timestamps to ISO strings where applicable
        def _convert_timestamps(obj):
            if isinstance(obj, dict):
                return {k: _convert_timestamps(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [_convert_timestamps(v) for v in obj]
            if isinstance(obj, datetime.datetime):
                return obj.isoformat()
            return obj

        safe_data = _convert_timestamps(data)

        return jsonify({'alert': safe_data, 'status': 'success'})

    except Exception as e:
        logging.exception('Error fetching alert')
        return jsonify({'error': str(e)}), 500
    


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    # Ensure Google clients attempt initialization for a meaningful health check on startup
    try:
        ensure_google_clients()
    except Exception:
        logging.exception('Error during initial Google client initialization')

    app.run(host="0.0.0.0", port=port)


