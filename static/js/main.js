document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const selectBtn = document.getElementById('select-video-btn');
    const statusDiv = document.getElementById('status');

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

        uploadFile(file);
    }

    function uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        setStatus(`Uploading and processing "${file.name}"...`, 'processing');

        fetch('/upload', {
            method: 'POST',
            body: formData,
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            setStatus(`Processing complete! Your video is ready for download.`, 'success');
            const downloadLink = document.createElement('a');
            downloadLink.href = data.downloadUrl;
            downloadLink.textContent = `Download ${file.name.replace(/(\.[\w\d_-]+)$/i, '_blurred$1')}`;
            downloadLink.style.color = '#818cf8';
            downloadLink.style.display = 'block';
            downloadLink.style.marginTop = '1rem';
            statusDiv.appendChild(downloadLink);
        })
        .catch(error => {
            setStatus(`Error: ${error.message}`, 'error');
        });
    }

    function setStatus(message, type) {
        statusDiv.innerHTML = message;
        statusDiv.style.color = type === 'error' ? '#f87171' : (type === 'success' ? '#4ade80' : '#9ca3af');
    }
}); 