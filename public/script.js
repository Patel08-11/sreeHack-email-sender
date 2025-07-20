document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const jsonUploadArea = document.getElementById('jsonUploadArea');
    const jsonFileInput = document.getElementById('jsonFileInput');
    const jsonFileStatus = document.getElementById('jsonFileStatus');
    const emailCountStatus = document.getElementById('emailCountStatus');
    const emailListSection = document.getElementById('emailListSection');
    const emailList = document.getElementById('emailList');

    const subjectInput = document.getElementById('subjectInput');
    const messageInput = document.getElementById('messageInput');

    const generalUploadArea = document.getElementById('generalUploadArea');
    const generalFilesInput = document.getElementById('generalFilesInput');
    const generalAttachmentsList = document.getElementById('generalAttachmentsList');

    const sendEmailsBtn = document.getElementById('sendEmailsBtn');
    const resultsSection = document.getElementById('resultsSection');
    const resultsList = document.getElementById('resultsList');
    const resetFormBtn = document.getElementById('resetFormBtn');
    const successCountEl = document.getElementById('successCount');
    const failureCountEl = document.getElementById('failureCount');

    // --- State Management ---
    let jsonFile = null;
    let generalFiles = [];
    let recipientEmails = [];

    // --- Form Validation ---
    const validateForm = () => {
        const isJsonValid = jsonFile && recipientEmails.length > 0;
        const isSubjectValid = subjectInput.value.trim() !== '';
        const isMessageValid = messageInput.value.trim() !== '';
        sendEmailsBtn.disabled = !(isJsonValid && isSubjectValid && isMessageValid);
    };

    // --- Event Listeners ---
    jsonUploadArea.addEventListener('click', () => jsonFileInput.click());
    jsonFileInput.addEventListener('change', (e) => handleJsonFile(e.target.files[0]));

    generalUploadArea.addEventListener('click', () => generalFilesInput.click());
    generalFilesInput.addEventListener('change', (e) => handleGeneralFiles(e.target.files));

    [subjectInput, messageInput].forEach(el => el.addEventListener('input', validateForm));

    sendEmailsBtn.addEventListener('click', sendEmails);
    resetFormBtn.addEventListener('click', resetForm);

    // --- File Handling ---
    function handleJsonFile(file) {
        if (!file) return;

        if (file.type !== 'application/json') {
            alert('Please upload a valid JSON file.');
            return;
        }

        jsonFile = file;
        jsonFileStatus.textContent = `File selected: ${file.name}`;
        jsonFileStatus.classList.remove('hidden');

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = JSON.parse(e.target.result);
                if (Array.isArray(content)) {
                    recipientEmails = content;
                } else if (content && Array.isArray(content.emails)) {
                    recipientEmails = content.emails;
                } else {
                    throw new Error('Invalid JSON format.');
                }
                emailCountStatus.textContent = `${recipientEmails.length} email(s) found.`;
                emailCountStatus.classList.remove('hidden');
                displayEmails(recipientEmails);
            } catch (err) {
                alert('Error parsing JSON file. Please check the format.');
                recipientEmails = [];
                emailCountStatus.textContent = 'Invalid JSON format.';
                emailListSection.classList.add('hidden');
            }
            validateForm();
        };
        reader.readAsText(file);
    }

    function handleGeneralFiles(files) {
        generalFiles = Array.from(files);
        generalAttachmentsList.innerHTML = '';
        if (generalFiles.length > 0) {
            generalFiles.forEach(file => {
                const fileEl = document.createElement('div');
                fileEl.className = 'attachment-item';
                fileEl.textContent = file.name;
                generalAttachmentsList.appendChild(fileEl);
            });
            generalAttachmentsList.classList.remove('hidden');
        } else {
            generalAttachmentsList.classList.add('hidden');
        }
    }

    function displayEmails(emails) {
        emailList.innerHTML = '';
        if (emails.length > 0) {
            emails.forEach(email => {
                const emailEl = document.createElement('span');
                emailEl.className = 'email-tag';
                emailEl.textContent = email;
                emailList.appendChild(emailEl);
            });
            emailListSection.classList.remove('hidden');
        } else {
            emailListSection.classList.add('hidden');
        }
    }

    // --- Main Send Logic ---
    async function sendEmails() {
        sendEmailsBtn.disabled = true;
        sendEmailsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        resultsSection.classList.remove('hidden');
        resultsList.innerHTML = '';

        const formData = new FormData();
        formData.append('jsonFile', jsonFile);
        formData.append('subject', subjectInput.value);
        formData.append('message', messageInput.value);
        generalFiles.forEach(file => {
            formData.append('attachments', file);
        });

        try {
            const response = await fetch('/send-emails', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                // Read the response body as text ONCE to avoid "body stream already read" error.
                const errorText = await response.text();
                let errorMsg = errorText;

                // Try to parse the text as JSON to get a structured error message.
                try {
                    const errorData = JSON.parse(errorText);
                    errorMsg = errorData.message || JSON.stringify(errorData);
                } catch (e) {
                    // It's not JSON, so we'll use the raw text as the error, which is already set.
                }

                // Throw a more informative error.
                throw new Error(`Server responded with ${response.status}: ${errorMsg}`);
            }

            const data = await response.json();
            displayResults(data.results);

        } catch (error) {
            const errorEl = document.createElement('div');
            errorEl.className = 'result-item failure';
            errorEl.innerHTML = `<strong>Network/Server Error:</strong> ${error.message}`;
            resultsList.appendChild(errorEl);
        } finally {
            sendEmailsBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Emails';
            // Keep it disabled after sending to force a reset
        }
    }

    function displayResults(results) {
        let successCount = 0;
        let failureCount = 0;

        results.forEach(result => {
            const resultEl = document.createElement('div');
            resultEl.className = `result-item ${result.status}`;
            resultEl.innerHTML = `<strong>${result.email}:</strong> ${result.message}`;
            resultsList.appendChild(resultEl);

            if (result.status === 'success') {
                successCount++;
            } else {
                failureCount++;
            }
        });

        successCountEl.textContent = `${successCount} successful`;
        failureCountEl.textContent = `${failureCount} failed`;
    }

    // --- Reset Logic ---
    function resetForm() {
        jsonFile = null;
        generalFiles = [];
        recipientEmails = [];

        jsonFileInput.value = '';
        generalFilesInput.value = '';
        subjectInput.value = '';
        messageInput.value = '';

        jsonFileStatus.classList.add('hidden');
        emailCountStatus.classList.add('hidden');
        emailListSection.classList.add('hidden');
        generalAttachmentsList.classList.add('hidden');
        resultsSection.classList.add('hidden');

        validateForm();
    }
});