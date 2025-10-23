import os
import uuid
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

import openai
import logging
from openai import AuthenticationError, RateLimitError, APIConnectionError, Timeout
from google.cloud import language_v1, firestore, texttospeech, storage

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

# Lazy placeholders for Google clients. We'll try to initialize them at first use.
language_client = None
firestore_client = None
tts_client = None
storage_client = None
bucket = None
google_clients_initialized = False

def ensure_google_clients():
    """Initialize Google clients lazily. Returns True on success, False on failure."""
    global language_client, firestore_client, tts_client, storage_client, bucket, google_clients_initialized
    if google_clients_initialized:
        return True
    try:
        # Cloud Run / GCE will use default credentials when available
        language_client = language_v1.LanguageServiceClient()
        firestore_client = firestore.Client()
        tts_client = texttospeech.TextToSpeechClient()
        storage_client = storage.Client()
        if GCS_BUCKET_NAME:
            bucket = storage_client.bucket(GCS_BUCKET_NAME)
        else:
            logging.warning("GCS_BUCKET_NAME not set - TTS upload disabled until configured.")
        google_clients_initialized = True
        logging.info("Google Cloud clients initialized.")
        return True
    except Exception as e:
        logging.exception("Failed to initialize Google Cloud clients: %s", e)
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
def sentiment():
    data = request.get_json()
    text = data.get("text")
    if not text:
        return jsonify({"error": "Missing 'text'"}), 400
    document = language_v1.Document(content=text, type_=language_v1.Document.Type.PLAIN_TEXT)
    try:
        sentiment_result = language_client.analyze_sentiment(request={"document": document}).document_sentiment
        return jsonify({
            "score": sentiment_result.score,
            "magnitude": sentiment_result.magnitude
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/tts", methods=["POST"])
def tts():
    data = request.get_json()
    text = data.get("text")
    if not text:
        return jsonify({"error": "Missing 'text'"}), 400
    synthesis_input = texttospeech.SynthesisInput(text=text)
    voice = texttospeech.VoiceSelectionParams(
        language_code="en-US", ssml_gender=texttospeech.SsmlVoiceGender.NEUTRAL
    )
    audio_config = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3)
    # Ensure Google clients are available
    if not ensure_google_clients():
        return jsonify({"error": "Google Cloud clients not available"}), 500
    if not bucket:
        return jsonify({"error": "GCS_BUCKET_NAME not configured"}), 500
    try:
        response = tts_client.synthesize_speech(input=synthesis_input, voice=voice, audio_config=audio_config)
        filename = f"audio/{uuid.uuid4()}.mp3"
        blob = bucket.blob(filename)
        blob.upload_from_string(response.audio_content, content_type="audio/mpeg")
        audio_url = f"https://storage.googleapis.com/{GCS_BUCKET_NAME}/{filename}"
        return jsonify({"audio_url": audio_url})
    except Exception as e:
        logging.exception("TTS failed: %s", e)
        return jsonify({"error": str(e)}), 500

@app.route("/api/mood", methods=["POST"])
def save_mood():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing mood data"}), 400
    if not ensure_google_clients():
        return jsonify({"error": "Google Cloud clients not available"}), 500
    try:
        doc_ref = firestore_client.collection("moods").document()
        doc_ref.set(data)
        return jsonify({"id": doc_ref.id})
    except Exception as e:
        logging.exception("Saving mood failed: %s", e)
        return jsonify({"error": str(e)}), 500

@app.route("/api/mood", methods=["GET"])
def get_moods():
    try:
        if not ensure_google_clients():
            return jsonify({"error": "Google Cloud clients not available"}), 500
        moods = []
        docs = firestore_client.collection("moods").order_by("timestamp", direction=firestore.Query.DESCENDING).limit(10).stream()
        for doc in docs:
            mood = doc.to_dict()
            mood["id"] = doc.id
            moods.append(mood)
        return jsonify(moods)
    except Exception as e:
        logging.exception("Fetching moods failed: %s", e)
        return jsonify({"error": str(e)}), 500
    
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

# --- Run app ---
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
