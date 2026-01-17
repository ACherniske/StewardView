/**
 * Check if an error is retryable
 * @param {Error} error - Error to check
 * @returns {boolean}
 */
function isRetryableError(error) {
    // Network errors are retryable
    if (error.message.includes('Failed to fetch') || 
        error.message.includes('NetworkError') ||
        error.message.includes('ERR_CONNECTION_REFUSED') ||
        error.message.includes('ERR_NETWORK') ||
        error.message.includes('ERR_INTERNET_DISCONNECTED')) {
        return true;
    }

    // Timeout errors are retryable
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        return true;
    }

    // 5xx server errors are retryable (except 501 Not Implemented)
    if (error.message.includes('status') && error.message.match(/5\d{2}/)) {
        const status = parseInt(error.message.match(/5\d{2}/)[0]);
        if (status !== 501) {
            return true;
        }
    }

    // 429 Too Many Requests is retryable
    if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
        return true;
    }

    // 408 Request Timeout is retryable
    if (error.message.includes('408') || error.message.includes('Request Timeout')) {
        return true;
    }

    // Default to not retryable for client errors (4xx)
    return false;
}

/**
 * Sleep helper function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise<any>}
 */
export async function retryWithBackoff(fn, options = {}) {
    const {
        maxRetries = 5,
        initialDelay = 1000,
        maxDelay = 30000,
        backoffMultiplier = 2,
        onRetry = null,
    } = options;

    let lastError;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            //attempt to call function
            return await fn();
        } catch (error) {
            lastError = error;

            //check if error is retryable
            if (!isRetryableError(error)) {
                throw error;
            }

            //if max retries reached, throw last error
            if (attempt === maxRetries) {
                throw error;
            }

            //calculate delay with exponential backoff
            const currentDelay = Math.min(delay * Math.pow(backoffMultiplier, attempt), maxDelay);

            //add jitter to avoid thundering herd
            const jitter = Math.random() * 0.3 * currentDelay;
            const delayWithJitter = currentDelay + jitter;

            console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delayWithJitter)}ms`);

            //call retry callback if provided
            if (onRetry) {
                await onRetry(attempt + 1, error);
            }

            //wait before retrying
            await sleep(delayWithJitter);
        }
    }

    throw lastError;
}