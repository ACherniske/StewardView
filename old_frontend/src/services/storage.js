import { openDB } from 'idb';

const DB_NAME = 'stewardview-db';
const DB_VERSION = 1;
const UPLOAD_STORE = 'uploads';

//upload status constants
export const UploadStatus = {
    PENDING: 'pending',
    UPLOADING: 'uploading',
    SUCCESS: 'success',
    FAILED: 'failed',
    RETRYING: 'retrying',
};

class StorageService {
    constructor() {
        this.db = null;
    }

    async init() {
        if (this.db) return;

        try {
            this.db = await openDB(DB_NAME, DB_VERSION, {
                upgrade(db, oldVersion, newVersion, transaction) {
                    //create uploads store if it doesnt exist
                    if (!db.objectStoreNames.contains(UPLOAD_STORE)) {
                        const store = db.createObjectStore(UPLOAD_STORE, {
                            keyPath: 'id',
                        });

                        //create indexes for querying
                        store.createIndex('by-status', 'status');
                        store.createIndex('by-date', 'createdAt');
                    }
                }
            });
        } catch (error) {
            console.error('Failed to initialize database:', error);
            throw error;
        }
    }

    //add upload to queue
    async addUpload(upload) {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        // For iOS Safari compatibility, convert File to ArrayBuffer
        if (upload.file instanceof File || upload.file instanceof Blob) {
            const arrayBuffer = await upload.file.arrayBuffer();
            const fileData = {
                buffer: arrayBuffer,
                name: upload.file.name,
                type: upload.file.type,
                size: upload.file.size,
                lastModified: upload.file.lastModified
            };
            upload = { ...upload, file: fileData };
        }

        await this.db.add(UPLOAD_STORE, upload);
    }

    //get upload by id
    async getUpload(id) {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        return await this.db.get(UPLOAD_STORE, id);
    }

    //get all uploads
    async getAllUploads() {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        return await this.db.getAll(UPLOAD_STORE);
    }

    //get uploads by status
    async getUploadsByStatus(status) {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        return await this.db.getAllFromIndex(UPLOAD_STORE, 'by-status', status);
    }

    //get pending uploads for retry
    async getPendingUploads() {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        const pending = await this.db.getAllFromIndex(UPLOAD_STORE, 'by-status', UploadStatus.PENDING);
        const failed = await this.db.getAllFromIndex(UPLOAD_STORE, 'by-status', UploadStatus.FAILED);
        return [...pending, ...failed];
    }

    //update upload
    async updateUpload(id, updates) {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        const existing = await this.db.get(UPLOAD_STORE, id);
        if (!existing) {
            console.warn(`Upload with id ${id} not found - may have been cleaned up`);
            return; // Silently return instead of throwing
        }

        const updated = { ...existing, ...updates };
        await this.db.put(UPLOAD_STORE, updated);
    }

    //delete upload
    async deleteUpload(id) {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        await this.db.delete(UPLOAD_STORE, id);
    }

    //cleanup successful uploads
    async clearSuccessfulUploads() {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        const successful = await this.db.getAllFromIndex(UPLOAD_STORE, 'by-status', UploadStatus.SUCCESS);

        const tx = this.db.transaction(UPLOAD_STORE, 'readwrite');
        await Promise.all([
            ...successful.map(upload => tx.store.delete(upload.id)),
            tx.done
        ]);
    }

    //get upload count by status
    async getUploadCount(status) {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        if (status) {
            return await this.db.countFromIndex(UPLOAD_STORE, 'by-status', status);
        }

        return await this.db.count(UPLOAD_STORE);
    }

    //clear all data (for debugging/reset)
    async clearAll() {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        const tx = this.db.transaction(UPLOAD_STORE, 'readwrite');
        await tx.store.clear();
        await tx.done;
    }
}

//export singleton instance
export const storageService = new StorageService();