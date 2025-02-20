const logInfo = (context: string, message: string, data?: any) => {
    console.log(`[${new Date().toISOString()}] [INFO] [${context}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
};

const log = ( message: string) => {
    console.log(`[${new Date().toISOString()}] ${message}`);
};


const logError = (context: string, message: string, error: any) => {
    console.error(
        `[${new Date().toISOString()}] [ERROR] [${context}] ${message}`,
        '\nError:', error,
        '\nStack:', error?.stack
    );
};

const logWarning = (context: string, message: string, data?: any) => {
    console.warn(`[${new Date().toISOString()}] [WARN] [${context}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
};

const logDebug = (context: string, message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
        console.debug(`[${new Date().toISOString()}] [DEBUG] [${context}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
};


export { logInfo, logError, logWarning, logDebug ,log};