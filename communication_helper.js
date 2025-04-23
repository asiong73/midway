// e:\Users\FALCON\Documents\midway-main\communication_helpers.js

/**
 * Sends a message to the solver content script and returns a Promise
 * that resolves with the response or rejects on error/timeout.
 *
 * @param {string} action - The action to perform.
 * @param {object} [data] - Optional data payload for the action.
 * @param {number} [timeoutMs=30000] - Optional timeout in milliseconds.
 * @returns {Promise<object>} - A promise resolving with the response data.
 */
window.sendMsgToSolverCS = function(action, data, timeoutMs = 30000) {
    return new Promise(function(resolve, reject) {
        // Corrected selector
        const messagesContainerSelector = "body > solver-ext-messages";
        let messagesContainer = document.querySelector(messagesContainerSelector);

        // Create the messages container if it doesn't exist
        if (!messagesContainer) {
            messagesContainer = document.createElement("solver-ext-messages");
            messagesContainer.style.display = "none";
            // Ensure body exists before appending
            if (document.body) {
                document.body.appendChild(messagesContainer);
            } else {
                // Handle cases where the script runs before body is ready (e.g., in <head>)
                document.addEventListener('DOMContentLoaded', () => {
                    // Re-check if container was added by another instance
                    if (!document.querySelector(messagesContainerSelector)) {
                         document.body.appendChild(messagesContainer);
                    }
                });
            }
        }

        // Create the specific message element
        const message = document.createElement("solver-ext-message");
        const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`; // Slightly more unique ID
        message.dataset.action = action;
        message.dataset.messageId = messageId;
        if (data !== undefined && data !== null) {
            try {
                message.dataset.data = encodeURIComponent(JSON.stringify(data));
            } catch (e) {
                // Reject the promise if stringification fails
                return reject(new Error("Failed to stringify message data: " + e.message));
            }
        }
        // Append message only if container exists
        if (messagesContainer) {
             messagesContainer.appendChild(message);
        } else {
             // Handle case where container wasn't appended yet (e.g. script in <head>)
             document.addEventListener('DOMContentLoaded', () => {
                 let container = document.querySelector(messagesContainerSelector);
                 if (container) {
                     container.appendChild(message);
                 } else {
                     // This case should ideally not happen if the above logic works
                     console.error("Solver message container not found even after DOMContentLoaded.");
                     reject(new Error("Solver message container could not be created or found."));
                 }
             });
        }


        let responseCheckInterval = null;
        let responseTimeout = null;

        // Corrected arrow function syntax
        const cleanup = () => {
            clearInterval(responseCheckInterval);
            clearTimeout(responseTimeout);
            responseTimeout = null; // Mark timeout as cleared
            // Check if message still exists before removing
            if (message && message.parentElement) {
                 message.remove();
            }
            // Remove container only if it's empty after removing the message
            // Need to query it again in case it was removed/re-added
            let currentContainer = document.querySelector(messagesContainerSelector);
            if (currentContainer && !currentContainer.hasChildNodes()) {
                currentContainer.remove();
            }
        };

        // Set a timeout for the response
        // Corrected arrow function syntax
        responseTimeout = setTimeout(() => {
            cleanup();
            reject(new Error(`Solver response timed out after ${timeoutMs}ms for action: ${action}`));
        }, timeoutMs);

        // Poll for the response attribute on the message element
        // Corrected arrow function syntax
        responseCheckInterval = setInterval(() => {
            // Ensure message element still exists in the DOM
            if (!message || !message.parentElement) {
                 // Avoid rejecting if already timed out or resolved/rejected
                 if (responseTimeout) { // Check if timeout is still active
                    cleanup();
                    reject(new Error("Solver message element was removed unexpectedly."));
                 }
                 return; // Stop interval check
            }

            if (message.dataset.response) {
                try {
                    const responseData = JSON.parse(decodeURIComponent(message.dataset.response));

                    if (responseData && responseData.error) {
                        reject(new Error(responseData.error));
                    } else {
                        resolve(responseData);
                    }
                } catch (e) {
                    reject(new Error("Cannot parse message response: " + e.message));
                } finally {
                    cleanup(); // Clean up immediately after processing response or error
                }
            }
        }, 200); // Check every 200ms
    });
};

/*
 * Execute callbacks triggered via a specific textarea.
 * Polls the DOM for the textarea.
 */
const callbackInterval = setInterval(function() {
    const callbackTextareaSelector = 'textarea[id=twocaptcha-callback-trigger]';
    const textarea = document.querySelector(callbackTextareaSelector);

    if (textarea) {
        const funcName = textarea.getAttribute('data-function');
        const data = textarea.value;
        textarea.remove(); // Remove the trigger element

        if (funcName && typeof window[funcName] === 'function') {
            try {
                console.log(`Executing callback: ${funcName}`);
                // Corrected function call
                windowfuncName; // Pass data to the function
            } catch (e) {
                console.error(`Error executing callback function ${funcName}:`, e);
            }
        } else {
            console.warn(`Callback function "${funcName}" not found or not a function.`);
        }
    }
}, 1000); // Check every second

/*
 * Execute autosubmit rules defined in a specific textarea.
 * Polls the DOM for the textarea.
 * WARNING: This executes code based on the textarea content, which can be a security risk
 * if the content source is not strictly controlled and trusted.
 */
const autosubmitInterval = setInterval(function() {
    const autosubmitTextareaSelector = 'textarea[id=twocaptcha-autosubmit-code]';
    const textarea = document.querySelector(autosubmitTextareaSelector);

    if (textarea) {
        const stepsCode = textarea.value.trim();
        textarea.remove(); // Remove the trigger element

        if (!stepsCode) {
            console.warn("Autosubmit textarea was found but empty.");
            return;
        }

        try {
            // Corrected arrow function syntax
            const steps = stepsCode.split("\n").map(stepStr => JSON.parse(stepStr));
            let currentElement = null;

            console.log("Executing autosubmit steps...");

            // Corrected loop condition
            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                console.log(`Step ${i}:`, step); // Log current step for debugging

                if (!step || typeof step.type !== 'string' || typeof step.value === 'undefined') {
                   throw new Error(`Invalid step format at index ${i}: ${JSON.stringify(step)}`);
                }


                switch (step.type) {
                    case 'source':
                        if (step.value === 'window') currentElement = window;
                        else if (step.value === 'document') currentElement = document;
                        else throw new Error(`Invalid source value: ${step.value}`);
                        break;
                    case 'query': // Added for selecting elements
                         if (!currentElement || typeof currentElement.querySelector !== 'function') {
                             throw new Error(`Cannot query on non-element at step ${i}. Current element: ${currentElement}`);
                         }
                         currentElement = currentElement.querySelector(step.value);
                         if (!currentElement) throw new Error(`Element not found for querySelector: ${step.value}`);
                         break;
                    case 'property':
                        if (currentElement === null || typeof currentElement === 'undefined') throw new Error(`Cannot access property "${step.value}" on null/undefined at step ${i}`);
                        // Handle potential assignment vs. access
                         if (typeof step.assignValue !== 'undefined') {
                             console.log(`Assigning value to ${step.value}:`, step.assignValue);
                             currentElement[step.value] = step.assignValue; // Assign value
                         } else {
                             console.log(`Accessing property: ${step.value}`);
                             currentElement = currentElement[step.value]; // Access property
                         }
                        break;
                    case 'method':
                        if (currentElement === null || typeof currentElement === 'undefined') throw new Error(`Cannot call method "${step.value}" on null/undefined at step ${i}`);
                        if (typeof currentElement[step.value] !== 'function') throw new Error(`"${step.value}" is not a function on the current element at step ${i}. Element: ${currentElement}`);

                        const args = step.args || [];
                        if (!Array.isArray(args)) throw new Error(`Invalid args format for method "${step.value}" at step ${i}`);

                        console.log(`Calling method: ${step.value} with args:`, args);
                        // Corrected method call using spread syntax
                        currentElement = currentElementstep.value;
                        break;
                    case 'index': // Accessing array/collection elements by index
                         if (currentElement === null || typeof currentElement === 'undefined') throw new Error(`Cannot access index "${step.value}" on null/undefined at step ${i}`);
                         const index = parseInt(step.value, 10);
                         if (isNaN(index)) throw new Error(`Invalid index value "${step.value}" at step ${i}`);
                         if (index < 0 || !currentElement[index]) throw new Error(`Index ${index} out of bounds or element not found at index for step ${i}`);
                         console.log(`Accessing index: ${index}`);
                         currentElement = currentElement[index];
                         break;
                    case 'event': // Added for dispatching events
                         if (!currentElement || typeof currentElement.dispatchEvent !== 'function') {
                             throw new Error(`Cannot dispatch event on non-element at step ${i}. Current element: ${currentElement}`);
                         }
                         const eventOptions = step.options || { bubbles: true, cancelable: true };
                         console.log(`Dispatching event: ${step.value} with options:`, eventOptions);
                         const event = new Event(step.value, eventOptions);
                         currentElement.dispatchEvent(event);
                         // Keep currentElement as is after dispatching an event, unless the event modifies the DOM structure significantly in a way that invalidates it.
                         break;
                     case 'delay': // Added for pausing execution
                         // IMPORTANT: Synchronous delay blocks the main thread!
                         // Consider async/await structure if long delays are needed without freezing UI.
                         const delayMs = parseInt(step.value, 10);
                         if (isNaN(delayMs) || delayMs <= 0) throw new Error(`Invalid delay value "${step.value}" at step ${i}`);
                         console.log(`Delaying synchronously for ${delayMs}ms...`);
                         const start = Date.now();
                         // Corrected loop condition
                         while (Date.now() < start + delayMs) { /* busy wait */ }
                         console.log("Delay finished.");
                         break;
                    default:
                        throw new Error(`Unknown step type "${step.type}" at index ${i}`);
                }
                 // Corrected loop condition and check
                 // Check if currentElement became null/undefined *unless* it's the last step
                 if ((currentElement === null || typeof currentElement === 'undefined') && i < steps.length - 1) {
                     console.warn(`Step ${i} (${step.type}: ${step.value}) resulted in null/undefined, subsequent steps might fail.`);
                     // Optionally break or throw here if subsequent steps are guaranteed to fail
                     // throw new Error(`Step ${i} resulted in null/undefined, cannot continue.`);
                 }
            }
            console.log("Autosubmit steps finished successfully.");
        } catch (e) {
            console.error("Error executing autosubmit steps:", e);
            // Optionally, notify the user or extension about the failure
        }
    }
}, 1000); // Check every second

// Optional: Add cleanup logic if needed, e.g., to stop intervals when the page unloads
// window.addEventListener('beforeunload', () => {
//     clearInterval(callbackInterval);
//     clearInterval(autosubmitInterval);
// });
