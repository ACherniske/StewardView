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

        this.db = await openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                //create uploads store if it doesnt exist
                if (!db.objectStoreNames.contains(UPLOAD_STORE)) {
                    const store = db.createObjectStore(UPLOAD_STORE, {
                        keyPath: 'id',
                    });

                    //create indexes for querying
                    uploadStore.createIndex('by-status', 'status');
                    uploadStore.createIndex('by-date', 'createdAt');
                }
            }
        });
    }

    //add upload queue
    async addUpload(upload) {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        await this.db.add(UPLOAD_STORE, upload);
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

        const pending = await this.db.getAllFromIndex(UPLOAD_STORE, 'by-status', UPLOAD_STATUS.PENDING);
        const failed = await this.db.getAllFromIndex(UPLOAD_STORE, 'by-status', UPLOAD_STATUS.FAILED);
        return [...pending, ...failed];
    }

    //update upload
    async updateUpload(id, updates) {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        const existing = await this.db.get(UPLOAD_STORE, id);
        if (!existing) throw new Error(`Upload with id ${id} not found`);

        const updated = { ...existing, ...updates };
        await this.db.put(UPLOAD_STORE, updated);
    }

    //delete upload
    async deleteUpload(id) {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        await this.db.delete(UPLOAD_STORE, id);
    }

    //cleanup
    async clearSuccessfulUploads() {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        const successful = await this.db.getAllFromIndex(UPLOAD_STORE, 'by-status', UPLOAD_STATUS.SUCCESS);

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
}

//export singleton instance
export const storageService = new StorageService();