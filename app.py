import os
import cv2
import numpy as np
from flask import Flask, render_template, request, send_from_directory, jsonify
from werkzeug.utils import secure_filename
from pathlib import Path
import uuid

app = Flask(__name__)

UPLOAD_FOLDER = 'uploads'
PROCESSED_FOLDER = 'processed'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['PROCESSED_FOLDER'] = PROCESSED_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)

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

def process_video(input_path, output_path):
    """Process video by applying a blur to each frame."""
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        return False
    
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        # Apply Gaussian blur to the entire frame
        blurred_frame = cv2.GaussianBlur(frame, (25, 25), 0)
        
        out.write(blurred_frame)
    
    cap.release()
    out.release()
    return True

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file:
        filename = secure_filename(file.filename)
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(input_path)
        
        processed_filename = f"blurred_{uuid.uuid4().hex[:8]}_{filename}"
        output_path = os.path.join(app.config['PROCESSED_FOLDER'], processed_filename)
        
        success = process_video(input_path, output_path)
        
        if success:
            return jsonify({'downloadUrl': f'/download/{processed_filename}'})
        else:
            return jsonify({'error': 'Failed to process video'}), 500

@app.route('/download/<filename>')
def download_file(filename):
    return send_from_directory(app.config['PROCESSED_FOLDER'], filename, as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True) 