document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const selectBtn = document.getElementById('select-video-btn');
    const statusDiv = document.getElementById('status');
    
    // Progress bar elements
    const progressContainer = document.getElementById('progress-container');
    const filenameSpan = document.getElementById('filename');
    const progressPercentage = document.getElementById('progress-percentage');
    const progressFill = document.getElementById('progress-fill');
    const progressStatus = document.getElementById('progress-status');
    
    // Video preview elements
    const videoPreviewContainer = document.getElementById('video-preview-container');
    const videoPreview = document.getElementById('video-preview');
    const videoOverlay = document.getElementById('video-overlay');
    const checkmark = document.getElementById('checkmark');

    // Open file dialog when drop zone or button is clicked
    selectBtn.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('click', () => fileInput.click());

    // Highlight drop zone when item is dragged over it
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');
    });

    // Handle dropped files
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (files.length) {
            handleFile(files[0]);
        }
    });

    // Handle file selection from dialog
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
    });

    function handleFile(file) {
        if (!file.type.startsWith('video/')) {
            setStatus('Error: Please select a video file.', 'error');
            return;
        }

        // Show video preview
        showVideoPreview(file);
        uploadFile(file);
    }

    function showVideoPreview(file) {
        const url = URL.createObjectURL(file);
        videoPreview.src = url;
        videoPreviewContainer.style.display = 'block';
        
        // Hide drop zone
        dropZone.style.display = 'none';
        
        // Hide checkmark initially
        checkmark.style.display = 'none';
        videoOverlay.classList.remove('show');
    }

    function showCheckmark() {
        checkmark.style.display = 'block';
        videoOverlay.classList.add('show');
    }

    function hideVideoPreview() {
        videoPreviewContainer.style.display = 'none';
        dropZone.style.display = 'block';
        checkmark.style.display = 'none';
        videoOverlay.classList.remove('show');
        
        // Clean up the object URL
        if (videoPreview.src) {
            URL.revokeObjectURL(videoPreview.src);
        }
    }

    function showProgressBar(filename) {
        filenameSpan.textContent = filename;
        progressPercentage.textContent = '0%';
        progressFill.style.width = '0%';
        progressStatus.textContent = 'Uploading...';
        progressContainer.style.display = 'block';
    }

    function updateProgress(percent, status) {
        progressPercentage.textContent = `${Math.round(percent)}%`;
        progressFill.style.width = `${percent}%`;
        if (status) {
            progressStatus.textContent = status;
        }
    }

    function hideProgressBar() {
        progressContainer.style.display = 'none';
    }

    function uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        setStatus(`Uploading and processing "${file.name}"...`, 'processing');
        showProgressBar(file.name);

        const xhr = new XMLHttpRequest();
        const startTime = Date.now();
        let uploadComplete = false;

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const uploadPercent = (e.loaded / e.total) * 100;
                const elapsed = (Date.now() - startTime) / 1000;
                const rate = e.loaded / elapsed; // bytes per second
                const remainingUpload = (e.total - e.loaded) / rate;
                
                // Upload is 70% of total process, processing is 30%
                const totalPercent = uploadPercent * 0.7;
                updateProgress(totalPercent, `Uploading... ${formatTime(remainingUpload)} remaining`);
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    if (data.error) {
                        throw new Error(data.error);
                    }
                    
                    uploadComplete = true;
                    updateProgress(70, 'Processing video...');
                    
                    // Estimate processing time based on file size
                    const fileSizeMB = file.size / (1024 * 1024);
                    const estimatedProcessingTime = Math.max(5, fileSizeMB * 2); // Rough estimate: 2 seconds per MB
                    
                    let processingElapsed = 0;
                    const processingInterval = setInterval(() => {
                        processingElapsed += 0.5;
                        const processingPercent = Math.min((processingElapsed / estimatedProcessingTime) * 30, 30);
                        const totalPercent = 70 + processingPercent;
                        const remaining = Math.max(0, estimatedProcessingTime - processingElapsed);
                        
                        if (processingElapsed >= estimatedProcessingTime) {
                            clearInterval(processingInterval);
                            updateProgress(100, 'Complete!');
                            
                            // Show checkmark
                            showCheckmark();
                            
                            setTimeout(() => {
                                setStatus(`Processing complete! Your video is ready for download.`, 'success');
                                
                                const downloadLink = document.createElement('a');
                                downloadLink.href = data.downloadUrl;
                                downloadLink.textContent = `Download ${file.name.replace(/(\.[\w\d_-]+)$/i, '_blurred$1')}`;
                                downloadLink.style.color = '#818cf8';
                                downloadLink.style.display = 'block';
                                downloadLink.style.marginTop = '1rem';
                                statusDiv.appendChild(downloadLink);
                                
                                // Hide progress bar after a delay
                                setTimeout(hideProgressBar, 3000);
                                
                                // Hide video preview after a longer delay
                                setTimeout(hideVideoPreview, 5000);
                            }, 500);
                        } else {
                            updateProgress(totalPercent, `Processing... ${formatTime(remaining)} remaining`);
                        }
                    }, 500);
                    
                } catch (error) {
                    setStatus(`Error: ${error.message}`, 'error');
                    updateProgress(0, 'Upload failed');
                    setTimeout(() => {
                        hideProgressBar();
                        hideVideoPreview();
                    }, 3000);
                }
            } else {
                setStatus(`Error: Upload failed with status ${xhr.status}`, 'error');
                updateProgress(0, 'Upload failed');
                setTimeout(() => {
                    hideProgressBar();
                    hideVideoPreview();
                }, 3000);
            }
        });

        xhr.addEventListener('error', () => {
            setStatus('Error: Network error during upload', 'error');
            updateProgress(0, 'Upload failed');
            setTimeout(() => {
                hideProgressBar();
                hideVideoPreview();
            }, 3000);
        });

        xhr.open('POST', '/upload');
        xhr.send(formData);
    }

    function formatTime(seconds) {
        if (seconds < 60) {
            return `${Math.round(seconds)}s`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = Math.round(seconds % 60);
            return `${minutes}m ${remainingSeconds}s`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return `${hours}h ${minutes}m`;
        }
    }

    function setStatus(message, type) {
        statusDiv.innerHTML = message;
        statusDiv.style.color = type === 'error' ? '#f87171' : (type === 'success' ? '#4ade80' : '#9ca3af');
    }
}); 