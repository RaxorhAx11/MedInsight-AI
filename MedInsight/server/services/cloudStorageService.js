const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const path = require("path");

const isCloudinaryConfigured = !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    !process.env.CLOUDINARY_CLOUD_NAME.includes("placeholder") &&
    !process.env.CLOUDINARY_CLOUD_NAME.includes("your_") &&
    process.env.CLOUDINARY_API_KEY &&
    !process.env.CLOUDINARY_API_KEY.includes("placeholder") &&
    !process.env.CLOUDINARY_API_KEY.includes("your_") &&
    process.env.CLOUDINARY_API_SECRET &&
    !process.env.CLOUDINARY_API_SECRET.includes("placeholder") &&
    !process.env.CLOUDINARY_API_SECRET.includes("your_")
);

if (isCloudinaryConfigured) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
    console.log("[CLOUD STORAGE] Cloudinary client configured successfully.");
} else {
    console.warn("\n========================================================");
    console.warn("WARNING: Cloudinary is not configured. Storing files locally in uploads/ directory.");
    console.warn("Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file for production.");
    console.warn("========================================================\n");
}

const uploadFromBuffer = (fileBuffer, options = {}) => {
    return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream(
            options,
            (error, result) => {
                if (result) {
                    resolve(result);
                } else {
                    reject(error);
                }
            }
        );
        stream.write(fileBuffer);
        stream.end();
    });
};

/**
 * Uploads a file buffer to Cloudinary or falls back to local storage.
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} originalName - Original name of the file
 * @param {string} mimeType - File mimetype
 * @param {string} type - 'report' or 'avatar'
 * @returns {Promise<{ url: string, publicId: string | null }>}
 */
const uploadFile = async (fileBuffer, originalName, mimeType, type = 'report') => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const baseName = path.basename(originalName);
    const originalNameCleaned = baseName.replace(/[^a-zA-Z0-9.-]/g, "_");

    if (isCloudinaryConfigured) {
        try {
            if (type === 'report') {
                const publicId = `reports/${uniqueSuffix}-${originalNameCleaned}`;
                const result = await uploadFromBuffer(fileBuffer, {
                    resource_type: "raw",
                    public_id: publicId
                });
                return {
                    url: result.secure_url,
                    publicId: result.public_id
                };
            } else {
                // avatar
                const publicId = `avatars/avatar-${uniqueSuffix}`;
                const result = await uploadFromBuffer(fileBuffer, {
                    resource_type: "image",
                    public_id: publicId
                });
                return {
                    url: result.secure_url,
                    publicId: result.public_id
                };
            }
        } catch (error) {
            console.error(`[CLOUD STORAGE] Cloudinary upload failed:`, error);
            throw new Error(`Cloud storage upload failed: ${error.message}`);
        }
    } else {
        // Local Fallback
        const relativeFolder = type === 'report' ? 'uploads' : 'uploads/avatars';
        const uploadDir = path.resolve(__dirname, '../', relativeFolder);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        const filename = type === 'report'
            ? `${uniqueSuffix}-${originalNameCleaned}`
            : `avatar-${uniqueSuffix}${path.extname(originalName)}`;
            
        const localPath = path.join(uploadDir, filename);
        fs.writeFileSync(localPath, fileBuffer);
        
        const relativePath = type === 'report'
            ? `uploads/${filename}`
            : `uploads/avatars/${filename}`;
            
        return {
            url: relativePath,
            publicId: null
        };
    }
};

/**
 * Deletes a file from Cloudinary or local storage.
 * @param {string} fileUrlOrPath - Path or full URL
 * @param {string|null} publicId - Optional public ID
 * @param {string} type - 'report' or 'avatar'
 * @returns {Promise<void>}
 */
const deleteFile = async (fileUrlOrPath, publicId = null, type = 'report') => {
    if (!fileUrlOrPath) return;

    if (fileUrlOrPath.startsWith("http") && fileUrlOrPath.includes("cloudinary.com")) {
        try {
            let pid = publicId;
            if (!pid) {
                // Try to parse publicId from URL
                const parts = fileUrlOrPath.split('/');
                const uploadIndex = parts.indexOf('upload');
                if (uploadIndex !== -1) {
                    const publicIdParts = parts.slice(uploadIndex + 2);
                    const publicIdWithExt = publicIdParts.join('/');
                    if (type === 'report') {
                        pid = publicIdWithExt; // raw resources need extension
                    } else {
                        const lastDot = publicIdWithExt.lastIndexOf('.');
                        pid = lastDot !== -1 ? publicIdWithExt.substring(0, lastDot) : publicIdWithExt;
                    }
                }
            }
            if (pid) {
                const resourceType = type === 'report' ? 'raw' : 'image';
                await cloudinary.uploader.destroy(pid, { resource_type: resourceType });
                console.log(`[CLOUD STORAGE] Successfully deleted asset from Cloudinary: ${pid}`);
            }
        } catch (error) {
            console.error("[CLOUD STORAGE] Failed to delete asset from Cloudinary:", error);
        }
    } else {
        // Local file cleanup
        try {
            // Check if it has protocol and host
            let cleanPath = fileUrlOrPath;
            if (cleanPath.startsWith("http")) {
                // Parse out URL parts to get relative path
                const urlObj = new URL(cleanPath);
                cleanPath = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
            }
            const absolutePath = path.resolve(__dirname, "../", cleanPath);
            if (fs.existsSync(absolutePath)) {
                fs.unlinkSync(absolutePath);
                console.log(`[CLOUD STORAGE] Successfully deleted local file: ${cleanPath}`);
            }
        } catch (error) {
            console.error("[CLOUD STORAGE] Failed to delete local file:", error);
        }
    }
};

module.exports = {
    uploadFile,
    deleteFile,
    isCloudinaryConfigured
};
