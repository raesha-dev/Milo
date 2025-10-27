import os
import uuid
import time
import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

import openai
import logging
from openai import AuthenticationError, RateLimitError, APIConnectionError, Timeout
from google.cloud import language_v1, firestore, texttospeech, storage
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from cloud_utils import (
    safe_cloud_operation,
    validate_google_credentials,
    CloudServiceError,
    RetryableError,
    NonRetryableError
)

# Load environment variables
load_dotenv()
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Expect environment variables (do not crash at import-time)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME")

# Configure OpenAI if available, otherwise defer and log
if OPENAI_API_KEY:
    openai.api_key = OPENAI_API_KEY
else:
    openai.api_key = None
    logging.warning("OPENAI_API_KEY not set - OpenAI features will return errors until configured.")

# Configure rate limiting
DEFAULT_LIMITS = {
    "1 per second": ["sentiment", "tts"],  # More expensive operations
    "5 per minute": ["chat"],  # Chat endpoints
    "10 per minute": ["mood"],  # Data storage operations
}

# Lazy placeholders for Google clients. We'll try to initialize them at first use.
language_client = None
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
    if not openai.api_key:
        ok = False
        details['openai'] = 'missing_api_key'
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
    try:
        response = openai.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": user_message}],
            max_tokens=150,
        )
        content = response.choices[0].message.content
        return jsonify({"response": content})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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
        
        # Generate signed URL for secure access
        audio_url = blob.generate_signed_url(
            version="v4",
            expiration=datetime.timedelta(minutes=15),
            method="GET"
        )
        
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

    if not ensure_google_clients():
        return jsonify({'error': 'Google Cloud services unavailable'}), 503

    try:
        document = language_v1.Document(content=text, type_=language_v1.Document.Type.PLAIN_TEXT)

        # Analyze entities
        entities_result = language_client.analyze_entities(request={'document': document})
        entities = [e.name for e in entities_result.entities]

        # Try content classification (may raise if not available for short texts)
        categories = []
        try:
            classify_result = language_client.classify_text(request={'document': document})
            categories = [c.name for c in classify_result.categories]
        except Exception:
            # classification may fail for short texts or unsupported content; ignore
            categories = []

        # Use available sentiment info
        sentiment_score = None
        sentiment_magnitude = None
        try:
            sentiment = language_client.analyze_sentiment(request={'document': document}).document_sentiment
            sentiment_score = sentiment.score
            sentiment_magnitude = sentiment.magnitude
        except Exception:
            if initial_sentiment and isinstance(initial_sentiment, dict):
                sentiment_score = initial_sentiment.get('score')
                sentiment_magnitude = initial_sentiment.get('magnitude')

        # Basic rule-based risk detection combined with NLP findings
        immediate_keywords = ['suicide', 'kill myself', 'end my life', 'want to die', 'hurt myself', 'self harm', 'cut myself']
        moderate_keywords = ['hopeless', 'worthless', 'no hope', 'give up', 'alone']

        text_low = text.lower()
        has_immediate = any(k in text_low for k in immediate_keywords)
        has_moderate = any(k in text_low for k in moderate_keywords)

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

        # Determine risk level
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

        return jsonify({
            'isRisky': risk_level != 'none',
            'riskLevel': risk_level,
            'reasons': reasons,
            'requiresImmediate': requires_immediate
        })

    except RetryableError as e:
        logging.error('Risk assessment failed after retries: %s', e)
        return jsonify({'error': 'Service temporarily unavailable'}), 503
    except NonRetryableError as e:
        logging.error('Non-retryable error in risk assessment: %s', e)
        return jsonify({'error': str(e)}), 400
    except CloudServiceError as e:
        logging.error('Cloud service error in risk assessment: %s', e)
        return jsonify({'error': 'Internal service error'}), 500
    except Exception as e:
        logging.exception('Unexpected error in risk assessment')
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

# --- Run app ---
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
