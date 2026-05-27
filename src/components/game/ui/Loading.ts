
// Create and show loading screen
function createLoadingScreen(): HTMLElement {
    const loadingContainer = document.createElement('div');
    loadingContainer.id = 'loading-screen';
    loadingContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #111111;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        font-family: 'Pixel', -apple-system, BlinkMacSystemFont, sans-serif;
    `;

    // Game title
    const title = document.createElement('h1');
    title.textContent = 'Game Loading';
    title.style.cssText = `
        color: white;
        font-size: 42px;
        font-weight: 300;
        margin-bottom: 40px;
        text-align: center;
        font-family: 'Pixel', sans-serif;
    `;

    // Loading bar container
    const progressContainer = document.createElement('div');
    progressContainer.style.cssText = `
        width: 300px;
        height: 4px;
        background: #333;
        border-radius: 2px;
        overflow: hidden;
        margin-bottom: 20px;
    `;

    // Loading bar fill
    const progressBar = document.createElement('div');
    progressBar.id = 'progress-bar';
    progressBar.style.cssText = `
        width: 0%;
        height: 100%;
        background: #7462B3;
        border-radius: 2px;
        transition: width 0.3s ease;
    `;

    // Loading text
    const loadingText = document.createElement('div');
    loadingText.id = 'loading-text';
    loadingText.textContent = 'Loading assets...';
    loadingText.style.cssText = `
        color: #999;
        font-size: 24px;
        text-align: center;
        font-family: 'Pixel', sans-serif;
    `;

    // Spinner (optional)
    const spinner = document.createElement('div');
    spinner.style.cssText = `
        width: 24px;
        height: 24px;
        border: 2px solid #333;
        border-top: 2px solid #7462B3;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-top: 20px;
    `;

    // Add spinner animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);

    progressContainer.appendChild(progressBar);
    loadingContainer.appendChild(title);
    loadingContainer.appendChild(progressContainer);
    loadingContainer.appendChild(loadingText);
    loadingContainer.appendChild(spinner);

    document.body.appendChild(loadingContainer);
    return loadingContainer;
}

// Update loading progress
function updateLoadingProgress(current: number, total: number, text: string = '') {
    const progressBar = document.getElementById('progress-bar');
    const loadingText = document.getElementById('loading-text');
    
    if (progressBar) {
        const percentage = Math.round((current / total) * 100);
        progressBar.style.width = `${percentage}%`;
    }
    
    if (loadingText && text) {
        loadingText.textContent = text;
    }
}

// Remove loading screen with fade effect
function removeLoadingScreen(): Promise<void> {
    return new Promise((resolve) => {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.transition = 'opacity 0.5s ease';
            loadingScreen.style.opacity = '0';
            
            setTimeout(() => {
                document.body.removeChild(loadingScreen);
                resolve();
            }, 500);
        } else {
            resolve();
        }
    });
}

export { createLoadingScreen, updateLoadingProgress, removeLoadingScreen };