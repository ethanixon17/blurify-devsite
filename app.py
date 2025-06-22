import os
import cv2
import numpy as np
from flask import Flask, render_template, request, send_file, jsonify, Response
from werkzeug.utils import secure_filename
from pathlib import Path
import uuid
import io
import tempfile

app = Flask(__name__)

def detect_license_plates(frame):
    """
    Basic license plate detection using contour detection and filtering.
    """
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    potential_plates = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area > 1000:
            x, y, w, h = cv2.boundingRect(contour)
            aspect_ratio = w / float(h)
            if 2.0 <= aspect_ratio <= 5.5:
                potential_plates.append((x, y, w, h))
    
    return potential_plates

def blur_region(frame, x, y, w, h, blur_strength=25):
    """Blur a specific region in the frame."""
    region = frame[y:y+h, x:x+w]
    blurred_region = cv2.GaussianBlur(region, (blur_strength, blur_strength), 0)
    frame[y:y+h, x:x+w] = blurred_region
    return frame

def process_video_in_memory(video_data):
    """Process video in memory and return the processed video data."""
    # Create temporary files for input and output
    with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as temp_input:
        temp_input_path = temp_input.name
        temp_input.write(video_data)
    
    with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as temp_output:
        temp_output_path = temp_output.name
    
    try:
        # Read video from temporary input file
        cap = cv2.VideoCapture(temp_input_path)
        
        if not cap.isOpened():
            return None
        
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(temp_output_path, fourcc, fps, (width, height))
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Apply Gaussian blur to the entire frame
            blurred_frame = cv2.GaussianBlur(frame, (25, 25), 0)
            
            out.write(blurred_frame)
        
        cap.release()
        out.release()
        
        # Read the processed video back into memory
        with open(temp_output_path, 'rb') as f:
            processed_video_data = f.read()
        
        return processed_video_data
        
    finally:
        # Clean up temporary files
        try:
            os.unlink(temp_input_path)
        except:
            pass
        try:
            os.unlink(temp_output_path)
        except:
            pass

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/how-it-works')
def how_it_works():
    return render_template('how_it_works.html')

@app.route('/privacy-policy')
def privacy_policy():
    return render_template('privacy_policy.html')

@app.route('/support')
def support():
    return render_template('support.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file:
        # Read the file data into memory
        video_data = file.read()
        
        # Process the video in memory
        processed_video_data = process_video_in_memory(video_data)
        
        if processed_video_data is None:
            return jsonify({'error': 'Failed to process video'}), 500
        
        # Generate a unique filename for the download
        original_filename = secure_filename(file.filename)
        filename_without_ext = os.path.splitext(original_filename)[0]
        processed_filename = f"{filename_without_ext}_blurred.mp4"
        
        # Store the processed video data in memory (you could use a cache here for production)
        # For now, we'll use a simple in-memory storage with a unique ID
        video_id = str(uuid.uuid4())
        app.video_cache = getattr(app, 'video_cache', {})
        app.video_cache[video_id] = {
            'data': processed_video_data,
            'filename': processed_filename
        }
        
        return jsonify({'downloadUrl': f'/download/{video_id}'})

@app.route('/download/<video_id>')
def download_file(video_id):
    app.video_cache = getattr(app, 'video_cache', {})
    
    if video_id not in app.video_cache:
        return jsonify({'error': 'Video not found'}), 404
    
    video_info = app.video_cache[video_id]
    video_data = video_info['data']
    filename = video_info['filename']
    
    # Create a file-like object from the video data
    video_stream = io.BytesIO(video_data)
    video_stream.seek(0)
    
    # Clean up the cached video data after sending
    del app.video_cache[video_id]
    
    return send_file(
        video_stream,
        mimetype='video/mp4',
        as_attachment=True,
        download_name=filename
    )

if __name__ == '__main__':
    app.run(debug=True) 