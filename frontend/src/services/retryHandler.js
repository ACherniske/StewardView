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