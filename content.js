console.log('Content script loaded');

// NoteStorage クラスのインスタンス化を最初に行う
let noteStorage;

// メモの状態管理クラス

// 1. エラーハンドリングの強化
class NoteError extends Error {
    constructor(message, type = 'general') {
        super(message);
        this.name = 'NoteError';
        this.type = type;
    }
}

// 2. パフォーマンス最適化のためのキャッシュシステム
class NoteCache {
    constructor() {
        this.cache = new Map();
        this.CACHE_DURATION = 5 * 60 * 1000; // 5分
    }

    set(key, value) {
        this.cache.set(key, {
            data: value,
            timestamp: Date.now()
        });
    }

    get(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;

        const isExpired = Date.now() - cached.timestamp > this.CACHE_DURATION;
        if (isExpired) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    clear() {
        this.cache.clear();
    }
}

// 1. 最初のセクション（クラスと初期設定）
class NoteStorage {
    constructor() {
        this.cache = new NoteCache(); // 
        this.cacheTimeout = 5 * 60 * 1000;
        this.retentionDays = 30;
        this._initialized = false;
        this.presetLock = false; // 同時実行制御用のロック
        this.presetInitQueue = []; // 初期化キューの追加
        this.defaultPresets = {
            1: [
                "[name]の表情が尊すぎる...🥺",
                "推しが尊いすぎて無理...😭💕",
                "この瞬間ガチ恋...💘",
                "[name]の切り替えすごすぎ！💪",
                "このシーン沼る...🌟",
                "[name]のオーラやばすぎ...✨",
                "最高に推せる瞬間...😌💕",
                "この表情最強すぎか！？🔥",
                "[name]の全てが尊い...🙏✨",
                "ここの[name]マジ天才...🎯"
            ],
            2: [
                "This performance was everything! ✨",
                "[name] ate and left no crumbs! 🔥",
                "The slay is real! Period! 💅",
                "[name] understood the assignment! 👑",
                "Living for this moment! 💖",
                "[name]'s energy is unmatched! ⚡️",
                "No thoughts, just [name] being iconic! 🌟",
                "Main character energy! We love to see it! 🎭",
                "[name] never misses! Periodt! 💯",
                "This is giving everything it needs to give! ✨"
            ],
            3: [
                "[name] 찢었다! 대박! 🔥",
                "이 장면 리플 중독... ✨",
                "[name] 믿고 보는 중! 💫",
                "찐찐찐! 레전드! 👑",
                "이 떵떵이 모먼트! 💅",
                "[name] 너무 심쿵해... 💝",
                "개좋아! 완전 내 취향! 💯",
                "역시 [name] 최고야! ⭐️",
                "이 부분 무한반복 중... 🎯",
                "visceral 찢었다! 👏✨"
            ]
        };
        this._initialized = false;
    }


    /**
     * ストレージシステムの初期化を行う
     * 1. Chrome Storage APIへのアクセス確認
     * 2. デフォルトデータの初期設定
     */
    async initialize() {
        if (this._initialized) return true;

        try {
            // Step 1: Storage APIアクセスの確認
            await this._verifyStorageAccess();

            this._initialized = true;
            return true;

        } catch (error) {
            console.error('Storage initialization failed:', error);
            return false;
        }
    }

    /**
     * Chrome Storage APIへのアクセスを確認
     * @private
     */
    async _verifyStorageAccess() {
        try {
            await chrome.storage.sync.get('test');
            return true;
        } catch (error) {
            console.error('Storage access verification failed:', error);
            throw new Error('Storage access denied');
        }
    }

    // 2. プリセット関連の内部メソッド（新規追加）
    async _acquirePresetLock() {
        while (this.presetLock) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        this.presetLock = true;
    }

    _releasePresetLock() {
        this.presetLock = false;
    }

    /**
     * デフォルトデータの初期設定
     * @private
     */
    async _initializePreset(presetNumber) {
        try {
            const key = `preset_templates_${presetNumber}`;
            const result = await chrome.storage.sync.get(key);
            
            if (!result[key]) {
                console.log(`Initializing preset ${presetNumber}`);
                await this.savePresetTemplates(
                    presetNumber, 
                    this.defaultPresets[presetNumber]
                );
            } else {
                console.log(`Preset ${presetNumber} already exists`);
            }
            return true;
        } catch (error) {
            console.error(`Failed to initialize preset ${presetNumber}:`, error);
            throw error;
        }
    }

    // 3. プリセット関連の公開メソッド
    async getCurrentPreset() {
        if (!this._initialized) {
            await this.initialize();
        }
        try {
            const result = await chrome.storage.sync.get('current_preset');
            return result.current_preset || 1;
        } catch (error) {
            console.error('Failed to get current preset:', error);
            return 1;
        }
    }

   async savePresetTemplates(presetNumber, templates) {
        if (!this._initialized) {
            await this.initialize();
        }

        await this._acquirePresetLock();
        try {
            const key = `preset_templates_${presetNumber}`;
            await chrome.storage.sync.set({ [key]: templates });
            return true;
        } catch (error) {
            console.error('Failed to save preset templates:', error);
            throw error;
        } finally {
            this._releasePresetLock();
        }
    }

    async loadPresetTemplates(presetNumber) {
        if (!this._initialized) {
            await this.initialize();
        }

        await this._acquirePresetLock();
        try {
            const key = `preset_templates_${presetNumber}`;
            const result = await chrome.storage.sync.get(key);
            return result[key] || this.defaultPresets[presetNumber];
        } catch (error) {
            console.error('Failed to load preset templates:', error);
            return this.defaultPresets[presetNumber];
        } finally {
            this._releasePresetLock();
        }
    }

    // 現在の動画IDを取得
    getCurrentVideoId() {
        const urlParams = new URLSearchParams(window.location.search);
        if (window.location.pathname !== '/watch') return null;  // 追加: パス判定のみ
        return urlParams.get('v');
    }

    // メモの保存
    async saveNotes(notes) {
        if (!this._initialized) {
            await this.initialize();
        }

        const videoId = this.getCurrentVideoId();
        if (!videoId) {
            throw new NoteError('Video ID not found', 'loading');
        }

        try {
            const storageKey = `notes_${videoId}`;
            const videoTitle = document.querySelector("h1.style-scope.ytd-watch-metadata")
                ?.textContent?.trim() || '';
            
            await chrome.storage.sync.set({
                [storageKey]: {
                    notes: notes,
                    videoTitle: videoTitle,
                    timestamp: Date.now()
                }
            });

            // キャッシュを更新
            this.cache.set(videoId, notes);
            
            showToast('メモを保存しました', 'success');
            return true;
        } catch (error) {
            throw new NoteError(
                'Failed to save notes', 
                error.message.includes('quota') ? 'storage' : 'network'
            );
        }
    }

    // メモの読み込み
    async loadNotes() {
        if (!this._initialized) {
            await this.initialize();
        }

        const videoId = this.getCurrentVideoId();
        if (!videoId) {
            throw new NoteError('Video ID not found', 'loading');
        }

        // キャッシュをチェック
        const cachedNotes = this.cache.get(videoId);
        if (cachedNotes) {
            console.log('Using cached notes for:', videoId);
            return cachedNotes;
        }

        try {
            const storageKey = `notes_${videoId}`;
            const result = await chrome.storage.sync.get(storageKey);
            const notes = result[storageKey]?.notes || [];
            
            // キャッシュを更新
            this.cache.set(videoId, notes);
            return notes;
        } catch (error) {
            throw new NoteError(
                'Failed to load notes from storage', 
                error.message.includes('quota') ? 'storage' : 'network'
            );
        }
    }

    // キャッシュのクリア
    clearCache() {
        this.cache.clear();
    }

    // NoteStorage クラス内に追加
    async savePresetNumber(number) {
        if (!this._initialized) {
            await this.initialize();
        }
        try {
            await chrome.storage.sync.set({ 'current_preset': number });
            return true;
        } catch (error) {
            console.error('Failed to save preset number:', error);
            return false;
        }
    }

    getDefaultTemplates(presetNumber) {
        const defaultPresets = {
            1: [
                "[name]の表情が尊すぎる...🥺",
                "推しが尊いすぎて無理...😭💕",
                "この瞬間ガチ恋...💘",
                "[name]の切り替えすごすぎ！💪",
                "このシーン沼る...🌟",
                "[name]のオーラやばすぎ...✨",
                "最高に推せる瞬間...😌💕",
                "この表情最強すぎか！？🔥",
                "[name]の全てが尊い...🙏✨",
                "ここの[name]マジ天才...🎯"
            ],
            2: [
                "This performance was everything! ✨",
                "[name] ate and left no crumbs! 🔥",
                "The slay is real! Period! 💅",
                "[name] understood the assignment! 👑",
                "Living for this moment! 💖",
                "[name]'s energy is unmatched! ⚡️",
                "No thoughts, just [name] being iconic! 🌟",
                "Main character energy! We love to see it! 🎭",
                "[name] never misses! Periodt! 💯",
                "This is giving everything it needs to give! ✨"
            ],
            3: [
                "[name] 찢었다! 대박! 🔥",
                "이 장면 리플 중독... ✨",
                "[name] 믿고 보는 중! 💫",
                "찐찐찐! 레전드! 👑",
                "이 떵떵이 모먼트! 💅",
                "[name] 너무 심쿵해... 💝",
                "개좋아! 완전 내 취향! 💯",
                "역시 [name] 최고야! ⭐️",
                "이 부분 무한반복 중... 🎯",
                "visceral 찢었다! 👏✨"
            ]
        };
        return defaultPresets[presetNumber] || defaultPresets[1];
    }

    // 保存期間の設定
    async setRetentionDays(days) {
        if (days >= 7 && days <= 365) {
            this.retentionDays = days;
            await chrome.storage.sync.set({ retentionDays: days });
            return true;
        }
        return false;
    }

    // 保存期間の取得
    async getRetentionDays() {
        try {
            const result = await chrome.storage.sync.get('retentionDays');
            return result.retentionDays || this.retentionDays;
        } catch {
            return this.retentionDays;
        }
    }

    // 保存された動画一覧を読み込む
    async loadSavedVideos() {
        if (!this._initialized) {
            await this.initialize();
        }

        try {
            // 保存期間の取得
            const retentionDays = await this.getRetentionDays();
            const retentionPeriod = retentionDays * 24 * 60 * 60 * 1000;
            const currentTime = Date.now();

            // すべてのストレージデータを取得
            const allData = await chrome.storage.sync.get(null);
            const videos = [];

            // notes_で始まるキーをフィルタリング
            for (const [key, value] of Object.entries(allData)) {
                if (!key.startsWith('notes_')) continue;

                const videoId = key.replace('notes_', '');
                const timestamp = value.timestamp || 0;

                // 保存期間を超えたデータを削除
                if (currentTime - timestamp > retentionPeriod) {
                    await chrome.storage.sync.remove(key);
                    continue;
                }

                // 動画情報をリストに追加
                videos.push({
                    id: videoId,
                    title: value.videoTitle || `Video ${videoId}`,
                    thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
                    notes: value.notes || [],
                    timestamp: value.timestamp,
                    channelIcon: value.channelIcon || null
                });
            }

            // タイムスタンプの新しい順にソート
            return videos.sort((a, b) => b.timestamp - a.timestamp);

        } catch (error) {
            console.error('Failed to load saved videos:', error);
            throw new Error('Failed to load saved videos');
        }
    }

    // 動画を開く
    async handleVideoOpen(videoId) {
        try {
            // バックグラウンドスクリプトに通知
            await chrome.runtime.sendMessage({
                type: 'VIDEO_OPEN',
                videoId: videoId
            });
            
            const url = `https://www.youtube.com/watch?v=${videoId}`;
            window.open(url, '_blank');
            return true;
        } catch (error) {
            console.error('Failed to open video:', error);
            // フォールバック: 直接URLを開く
            window.open(url, '_blank');
            return false;
        }
    }

    // メモの削除
    async deleteVideo(videoId) {
        if (!this._initialized) {
            await this.initialize();
        }

        try {
            await chrome.storage.sync.remove(`notes_${videoId}`);
            this.cache.delete(videoId);
            return true;
        } catch (error) {
            console.error('Failed to delete video:', error);
            return false;
        }
    }

    // すべてのメモを削除
    async clearAllNotes() {
        if (!this._initialized) {
            await this.initialize();
        }

        try {
            const allData = await chrome.storage.sync.get(null);
            const noteKeys = Object.keys(allData).filter(key => key.startsWith('notes_'));
            await chrome.storage.sync.remove(noteKeys);
            this.cache.clear();
            return true;
        } catch (error) {
            console.error('Failed to clear all notes:', error);
            return false;
        }
    }

}

// 2. グローバル変数の定義

let notes = [];
let templates = []; // 空の配列として初期化
let currentTheme = 'dark';
let selectedNote = null;
let newlyAddedNote = null;
let sidebarContainer;
let isInitialized = false;

// デバウンス処理付き自動保存の実装
let autoSaveTimeout;
let lastSavedContent = '';
let isSaving = false;


// アイコン定数
const ICONS = {
    ADD_NOTE: 'add_circle',
    INSERT_TEMPLATE: 'input',
    COPY: 'content_copy',
    DOWNLOAD: 'download_for_offline',
    EDIT: 'edit',
    SAVE: 'bookmark',
    MANAGE: 'video_library',
    SHARE: 'send',
    DELETE: 'delete',
    CLOSE: 'close'
};


// 3. 初期化関数とイベントリスナー
// 初期化処理の改善
let initializationInProgress = false;

// initializeVideoFeatures関数の修正
async function initializeVideoFeatures() {
    if (initializationInProgress) return;
    initializationInProgress = true;

    try {
        if (!noteStorage) {
            noteStorage = new NoteStorage();
            await noteStorage.initialize();
        }
        
        await createMemoSidebar();
        
    } catch (error) {
        console.error('Initialization failed:', error);
        if (error instanceof NoteError) {
            showUserFriendlyError(error);
        } else {
            showUserFriendlyError(new NoteError('Unexpected error occurred', 'general'));
        }
    } finally {
        initializationInProgress = false;
    }
}

function showUserFriendlyError(error) {
    console.error('Error details:', error);
    
    const messages = {
        'loading': 'Please try reloading.',
        'storage': 'Please check your browser settings.',
        'network': 'Please check your connection.',
        'general': 'Please try again later.'
    };

    const message = messages[error.type] || messages.general;
    showToast(message, 'warning');

    // エラーの種類に応じて自動リカバリを試みる
    if (error.type === 'loading') {
        setTimeout(() => initializeVideoFeatures(), 3000);
    }
}

let navigationTimeout;

// イベントリスナーの設定
document.addEventListener("DOMContentLoaded", initializeVideoFeatures);

// YouTubeのSPA遷移を検出して初期化
window.addEventListener("yt-navigate-finish", () => {
    console.log('Navigation detected');
    clearTimeout(navigationTimeout);
    navigationTimeout = setTimeout(() => {
        initializeVideoFeatures();
    }, 1000);
});

// 新しいメッセージリスナー
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'LOAD_VIDEO_DATA') {
        console.log('Received video data:', message.videoId);
        initializeWithVideoId(message.videoId);
        return true; // 非同期レスポンスのため
    }
});

// 新しく追加する初期化関数
function updateVideoList(container, filteredVideos) {
    // タイトルでソート
    const sortedVideos = filteredVideos.sort((a, b) => {
        return a.title.localeCompare(b.title);
    });
    
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const pageVideos = sortedVideos.slice(startIndex, endIndex);
    
    // リストの更新
    container.innerHTML = '';
    pageVideos.forEach(video => {
        if (!video) return;
        const videoItem = createVideoListItem(video);
        container.appendChild(videoItem);
    });

    // ページネーションの更新
    updatePagination(sortedVideos);

    if (sortedVideos.length === 0) {
        const noResults = document.createElement('div');
        noResults.textContent = '検索結果が見つかりません';
        Object.assign(noResults.style, {
            textAlign: 'center',
            padding: '20px',
            color: currentTheme === 'light' ? '#666' : '#999',
            fontWeight: '500'
        });
        container.appendChild(noResults);
    }
}


// YouTubeのUI待機関数（既存の関数を改善）
async function waitForYouTubeUI() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 20;
        
        const checkForUI = () => {
            const container = document.querySelector("#secondary");
            if (container) {
                console.log('YouTube UI found successfully');
                resolve(container);
                return;
            }
            
            attempts++;
            if (attempts >= maxAttempts) {
                console.warn('Failed to find YouTube UI');
                reject(new Error('YouTube UI not found after ' + maxAttempts + ' attempts'));
                return;
            }
            
            setTimeout(checkForUI, 500);
        };
        
        checkForUI();
    });
}

// 統合されたイベントハンドラー
function handleNavigation() {
    console.log('Navigation detected, reinitializing...');
    clearTimeout(navigationTimeout);
    navigationTimeout = setTimeout(() => {
        waitForYouTubeUI();
    }, 1000);
}


// テーマのセットアップ
function setupTheme() {
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");
    // 初期値の設定
    currentTheme = prefersDarkScheme.matches ? 'dark' : 'light';
    
    // システムのテーマ変更を監視
    prefersDarkScheme.addEventListener('change', (e) => {
        currentTheme = e.matches ? 'dark' : 'light';
        applyTheme(currentTheme);
    });

    // 保存された設定があれば読み込む
    chrome.storage.sync.get(['theme'], (result) => {
        if (result.theme) {
            currentTheme = result.theme;
            applyTheme(currentTheme);
        }
    });

    // 初期テーマを適用
    applyTheme(currentTheme);
}

// テーマの適用
function applyTheme(theme) {
    currentTheme = theme;
    
    // メモサイドバーが存在する場合のみ更新
    const updateExistingUI = () => {
        const sidebar = document.querySelector("#memoSidebar");
        if (sidebar) {
            sidebar.style.backgroundColor = currentTheme === 'light' ? '#ffffff' : '#2a2a2a';
            sidebar.style.border = `1px solid ${currentTheme === 'light' ? '#e0e0e0' : '#444'}`;

            // テキストエリアの更新
            sidebar.querySelectorAll("textarea").forEach(textarea => {
                textarea.style.backgroundColor = currentTheme === 'light' ? '#fff' : '#16181c';
                textarea.style.color = currentTheme === 'light' ? '#000' : '#fff';
                textarea.style.border = `1px solid ${currentTheme === 'light' ? '#cfd9de' : '#333639'}`;
            });

            // ボタンの更新
            sidebar.querySelectorAll("button").forEach(button => {
                if (button.classList.contains('share-button')) {
                    button.style.color = '#1DA1F2';
                } else {
                    button.style.color = currentTheme === 'light' ? '#666' : '#999';
                }
            });
        }
    };

    // 即時実行
    updateExistingUI();
}

// YouTubeのSPA遷移検出時にもテーマを再適用
window.addEventListener("yt-navigate-finish", () => {
    setTimeout(() => {
        applyTheme(currentTheme);
    }, 1000);
});

// 初期化
setupTheme();

// ナビゲーション検出のイベントリスナーを修正
window.addEventListener("yt-navigate-finish", () => {
    console.log('Navigation detected');
    clearTimeout(window.navigationTimeout);
    window.navigationTimeout = setTimeout(waitForYouTubeUI, 1000);
});


// 初期ロード時
waitForYouTubeUI();

// ノート一覧の更新
function updateNotesUI() {
    const notesContainer = document.querySelector("#notesContainer");
    if (!notesContainer) return;

    notesContainer.innerHTML = "";

    notes.forEach(note => {
        const noteElement = document.createElement("div");
        noteElement.className = "note";

        // ここで初期背景色を設定する必要があります
        noteElement.style.backgroundColor = currentTheme === 'light' ? '#ffffff' : '#2a2a2a';
        
        // 左側のコントロール（シェアボタンとタイムスタンプ）
        const leftControls = document.createElement("div");
        leftControls.style.display = "flex";
        leftControls.style.alignItems = "center";
        leftControls.style.minWidth = "80px";
        leftControls.style.gap = "4px";

        const shareButton = createShareButton(note);
        const timestamp = createTimestamp(note);
        
        leftControls.appendChild(shareButton);
        leftControls.appendChild(timestamp);

        // テキストエリア
        const textarea = createNoteTextArea(note);
        
        // 削除ボタン
        const deleteButton = createDeleteButton(note);

        // 要素を組み立て
        noteElement.appendChild(leftControls);
        noteElement.appendChild(textarea);
        noteElement.appendChild(deleteButton);

        // ノート選択とホバーエフェクトの設定
        setupNoteSelection(noteElement, note);
        setupHoverEffect(noteElement, note);

        notesContainer.appendChild(noteElement);
    });
}

// ノートコンテナの作成
function createNotesContainer() {
    const container = document.createElement("div");
    container.id = "notesContainer";
    Object.assign(container.style, {
        flex: 1,
        overflowY: "auto",
        paddingRight: "4px"
    });
    return container;
}

// サブボタンコンテナの作成を改善
function createSubButtonContainer() {
    const container = document.createElement("div");
    container.className = "subButtonContainer";
    Object.assign(container.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0px',
        borderTop: `1px solid ${currentTheme === 'light' ? '#e0e0e0' : '#444'}`,
        backgroundColor: currentTheme === 'light' ? '#ffffff' : '#2a2a2a',
        gap: '0px',
        flexShrink: 0,
        width: '100%',
        position: 'sticky',
        bottom: 0,
        left: 0,
        zIndex: 1
    });

    // 左側のボタングループ-----------------------------------
    const leftButtonGroup = document.createElement("div");
    Object.assign(leftButtonGroup.style, {
        display: 'flex',
        gap: '0px',
        paddingTop: '8px',
        paddingLeft: '8px'
    });

    // 一括コピーボタン
    const copyAllButton = createButton(
        "content_copy",
        "Copy all notes",
        () => copyAllNotes()
    );

    // 一括ダウンロードボタン
    const downloadButton = createButton(
        "download_for_offline",
        "Download all screenshots",
        () => {
            const timecodes = notes.map(note => note.timestampInSeconds);
            downloadScreenshotsAsZip(timecodes);
        }
    );

    // 中央のボタングループ-----------------------------------
    const centerGroup = document.createElement("div");
    Object.assign(centerGroup.style, {
        display: 'flex',
        alignItems: 'center',
        paddingTop: '8px',
        gap: '0px'

    });

    // テンプレート編集ボタン
    const editTemplateButton = createButton(
        "edit",
        "Edit templates",
        () => editTemplates()
    );

    // プリセット切り替えグループ
    const presetGroup = document.createElement("div");
    Object.assign(presetGroup.style, {
        display: 'flex',
        alignItems: 'center',
        backgroundColor: currentTheme === 'light' ? '#f0f0f0' : '#2a2a2a',
        borderRadius: '8px',
        padding: '2px',
        gap: '2px'
    });

    // プリセットボタンの初期化
    initializePresetButtons(presetGroup);


    // 右側のボタングループ-----------------------------------
    const rightButtonGroup = document.createElement("div");
    Object.assign(rightButtonGroup.style, {
        display: 'flex',
        gap: '0px',
        paddingTop: '8px',
        paddingRight: '8px'
    });

    // 保存ボタン
    const saveButton = createButton(
        "bookmark",
        "Save current notes",
        async () => {
            try {
                await noteStorage.saveNotes(notes);
                showToast('Notes saved successfully!', 'success');
            } catch (error) {
                showToast('Failed to save notes', 'error');
            }
        }
    );

    // 保存リスト表示ボタン
    const manageVideosButton = createButton(
        "video_library",
        "Manage saved videos",
        () => showVideoManager()
    );

    // 左グループにボタンを追加
    leftButtonGroup.appendChild(copyAllButton);
    leftButtonGroup.appendChild(downloadButton);

    // 中央グループにプリセット、編集、全選択ボタンを追加
    centerGroup.appendChild(editButton);
    centerGroup.appendChild(presetGroup);

    // 右グループにボタンを追加
    rightButtonGroup.appendChild(saveButton);
    rightButtonGroup.appendChild(manageVideosButton);

    // メインコンテナにグループを追加
    container.appendChild(leftButtonGroup);
    container.appendChild(centerGroup);
    container.appendChild(rightButtonGroup);

    return container;
}

async function initializePresetButtons(container) {
    try {
        const currentPreset = await noteStorage.getCurrentPreset();
        const buttons = [1, 2, 3].map(num => {
            const button = document.createElement("button");
            button.textContent = num;
            Object.assign(button.style, {
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
            });

            // アクティブ状態の設定
            updatePresetButtonStyle(button, num === currentPreset);

            // クリックイベントの設定
            button.addEventListener("click", async () => {
                try {
                    await handlePresetChange(num, container);
                    // テンプレートの更新を確実に行う
                    await updateTemplatesAfterPresetChange(num);
                } catch (error) {
                    console.error('Failed to handle preset change:', error);
                    showToast('プリセットの切り替えに失敗しました', 'error');
                }
            });

            // ホバーエフェクトの設定
            button.addEventListener('mouseenter', () => {
                if (!button.classList.contains('active')) {
                    button.style.backgroundColor = currentTheme === 'light' ? 
                        'rgba(26, 115, 232, 0.1)' : 'rgba(122, 180, 255, 0.1)';
                }
            });
            button.addEventListener('mouseleave', () => {
                if (!button.classList.contains('active')) {
                    button.style.backgroundColor = 'transparent';
                }
            });

            return button;
        });

        // ボタンを追加
        buttons.forEach(button => container.appendChild(button));
    } catch (error) {
        console.error('Failed to initialize preset buttons:', error);
        showToast('プリセットボタンの初期化に失敗しました', 'error');
    }
}


// テンプレート更新用の新しい関数
async function updateTemplatesAfterPresetChange(presetNumber) {
    try {
        // 新しいプリセットのテンプレートを読み込む
        const newTemplates = await noteStorage.loadPresetTemplates(presetNumber);
        
        // グローバル変数を更新
        templates = newTemplates;
        
        // セレクトボックスを更新
        const templateSelect = document.querySelector("select");
        if (templateSelect) {
            // 既存のオプションをクリア
            templateSelect.innerHTML = "";
            
            // 新しいテンプレートでオプションを追加
            templates.forEach(template => {
                const option = document.createElement("option");
                option.value = template;
                option.text = template;
                templateSelect.add(option);
            });
        }
        
        console.log('Templates updated for preset:', presetNumber);
    } catch (error) {
        console.error('Failed to update templates:', error);
        showToast('テンプレートの更新に失敗しました', 'error');
    }
}

// プリセットボタンのスタイル更新関数を更新
function updatePresetButtonStyle(button, isActive) {
    button.classList.toggle('active', isActive);
    Object.assign(button.style, {
        backgroundColor: isActive ? 
            (currentTheme === 'light' ? '#1a73e8' : '#7ab4ff') : 
            'transparent',
        color: isActive ? 
            '#ffffff' : 
            (currentTheme === 'light' ? '#666666' : '#999999')
    });
}

// 外部からの呼び出し方法
async function handlePresetChange(presetNumber, buttonGroup) {
    try {
        // NoteStorage インスタンスのメソッドを使用
        const currentPreset = await noteStorage.getCurrentPreset();
        
        // 現在のテンプレートを保存
        await noteStorage.savePresetTemplates(currentPreset, [...templates]);
        
        // 新しいプリセット番号を保存
        await noteStorage.savePresetNumber(presetNumber);
        
        // 新しいテンプレートを読み込む
        templates = await noteStorage.loadPresetTemplates(presetNumber);
        
        // UI更新
        updateUIAfterPresetChange(buttonGroup, presetNumber);
        
    } catch (error) {
        console.error('Preset change failed:', error);
        showToast('プリセットの切り替えに失敗しました', 'error');
    }
}


// UI更新用のヘルパー関数
function updateUIAfterPresetChange(buttonGroup, presetNumber) {
    // ボタンのスタイル更新
    Array.from(buttonGroup.children).forEach((btn, index) => {
        updatePresetButtonStyle(btn, index + 1 === presetNumber);
    });
    
    // テンプレート選択の更新
    const templateSelect = document.querySelector("select");
    if (templateSelect) {
        updateTemplateSelect(templateSelect);
    }
}


// 2. デバッグ用のログ機能を追加
function logPresetOperation(operation, presetNumber, templates) {
    console.log(`[Preset ${presetNumber}] ${operation}:`, {
        timestamp: new Date().toISOString(),
        presetNumber,
        templatesCount: templates.length,
        templates
    });
}

// 2. ボタン作成のシンプル化
function createButton(iconName, title, onClick) {
    const button = document.createElement("button");
    button.innerHTML = `<span class="material-icons">${iconName}</span>`;
    button.title = title;
    button.style.cssText = `
        cursor: pointer;
        background: none;
        border: none;
        padding: 4px;
        color: ${currentTheme === 'light' ? '#666' : '#999'};
        display: flex;
        align-items: center;
    `;

    if (onClick) {
        button.addEventListener("click", onClick);
    }

    return button;
}

// 3. アイコンボタンの使用例
const addNoteButton = createButton("add_circle", "Add note", addNote);
const copyButton = createButton("content_copy", "Copy all", copyAllNotes);
const editButton = createButton("edit", "Edit templates", editTemplates);


// 新しいノートまでスクロール
function scrollToNewNote(timestamp) {
    const noteElements = document.querySelectorAll(".note");
    for (const element of noteElements) {
        const timestampElement = element.querySelector('[data-timestamp="true"]');
        if (timestampElement && timestampElement.textContent === timestamp) {
            if (!isElementInView(element, element.parentElement)) {
                element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            element.style.animation = 'none';
            requestAnimationFrame(() => {
                element.style.animation = 'highlightNew 1s ease';
            });
            break;
        }
    }
}

// 要素が表示領域内にあるかチェック
function isElementInView(element, container) {
    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    return (
        elementRect.bottom <= containerRect.bottom &&
        elementRect.top >= containerRect.top
    );
}

// メモサイドバーの作成
async function createMemoSidebar() {
    try {
        if (!noteStorage) {
            noteStorage = new NoteStorage();
        }
        await noteStorage.initialize();

        const sideBarContainer = await waitForYouTubeUI();
        if (!sideBarContainer) {
            throw new Error('Sidebar container not found');
        }

        notes = await noteStorage.loadNotes() || [];
        
        const existingSidebar = document.querySelector("#memoSidebar");
        if (existingSidebar) {
            existingSidebar.remove();
        }

        const sidebar = createBaseSidebar();
        if (!sidebar) {
            throw new Error('Failed to create base sidebar');
        }

        const mainButtonContainer = await createMainButtonContainer(); // ここを await に変更
        const notesContainer = createNotesContainer();
        const subButtonContainer = createSubButtonContainer();

        // 内部コンテナに追加
        sidebar.innerContainer.appendChild(mainButtonContainer);
        sidebar.innerContainer.appendChild(notesContainer);
        
        // subButtonContainerはメインのコンテナに追加
        sidebar.appendChild(subButtonContainer);
        
        sideBarContainer.insertBefore(sidebar, sideBarContainer.firstChild);
        
        updateNotesUI();
        addMaterialIconsSupport();
        
        return true;

    } catch (error) {
        console.error('Failed to create memo sidebar:', error);
        console.log('Error details:', {
            noteStorage: !!noteStorage,
            error: error.message,
            stack: error.stack
        });
        return false;
    }
}

// ベースのサイドバー作成
function createBaseSidebar() {
    const container = document.createElement("div");
    container.id = "memoSidebar";
    Object.assign(container.style, {
        width: "400px",
        marginTop: "0",
        padding: "0",
        border: "1px solid #444",
        borderRadius: "12px",
        fontSize: "14px",
        boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
        position: "relative",
        backgroundColor: currentTheme === 'light' ? '#ffffff' : '#2a2a2a',
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        alignSelf: "flex-start"
    });


    // 内部コンテナを追加
    const innerContainer = document.createElement("div");
    Object.assign(innerContainer.style, {
        padding: "0px 6px",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        overflowY: "auto",
        height: "calc(100vh - 120px)",
        maxHeight: "400px"
    });
    
    container.appendChild(innerContainer);
    // コンテナに参照を保持させる
    container.innerContainer = innerContainer;

    return container;
}

// メインボタンコンテナの作成を改善（ボタン配置の修正）
// メインボタンコンテナの作成を改善（async化）
async function createMainButtonContainer() {
    try {
        // メインコンテナの作成-----------------------------
        const container = document.createElement("div");
        container.className = "main-button-container";
        Object.assign(container.style, {
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "center",
            gap: "6px",
            padding: "0px 6px",
            position: "relative",
            marginBottom: "8px"
        });

        // Add Noteボタン
        const addNoteButton = createButton("add_circle", "Add note", () => addNote());

        // テンプレート選択の作成
        const templateSelect = document.createElement("select");
        templateSelect.style.maxWidth = "280px";
        templateSelect.style.flexGrow = "1";

        // テンプレートの初期化を待つ
        await initializeTemplates();
        
        // デフォルトテンプレートの追加
        if (templates && templates.length) {
            templates.forEach(template => {
                const option = document.createElement("option");
                option.value = template;
                option.text = template;
                templateSelect.add(option);
            });
        }

        // テンプレート挿入ボタン
        const insertTemplateButton = createButton("input", "Insert template", () => {
            if (selectedNote && templateSelect.value) {
                insertTemplate(selectedNote, templateSelect.value); // Use the new insertTemplate function
            }
        });

        // ボタンの追加
        container.appendChild(addNoteButton);
        container.appendChild(insertTemplateButton);
        container.appendChild(templateSelect);

        return container;
    } catch (error) {
        console.error('Failed to create main button container:', error);
        return document.createElement('div'); // フォールバック
    }
}


// 文字数カウンターの改善
function createCharacterCounter() {
    const counter = document.createElement('div');
    Object.assign(counter.style, {
        position: 'absolute',
        bottom: '12px',
        right: '12px',
        color: currentTheme === 'light' ? '#666666' : '#71767b',
        fontSize: '14px',
        padding: '4px 8px',
        borderRadius: '4px',
        backgroundColor: currentTheme === 'light' ? '#f8f9fa' : '#16181c',
        display: 'flex',
        alignItems: 'center',
        gap: '2px'
    });

    // 内部のアップデート関数
    counter.update = function(count) {
        const remaining = 280 - count;
        const color = remaining < 0 ? '#f4212e' : remaining < 20 ? '#ffd400' : '#1d9bf0';
        
        counter.innerHTML = `
            <span style="
                color: ${color};
                font-weight: 600;
            ">${remaining}</span>
            <span style="
                color: #71767b;
                opacity: 0.7;
            ">/280</span>
        `;

        return remaining;
    };

    return counter;
}


// テンプレート選択の作成
async function createTemplateSelect() {
    const select = document.createElement("select");
    select.style.maxWidth = "280px";
    select.style.flexGrow = "1";
    
    try {
        // 現在のプリセット番号を取得
        const currentPreset = await noteStorage.getCurrentPreset();
        // 現在のプリセットのテンプレートを読み込む
        templates = await noteStorage.loadPresetTemplates(currentPreset);
        
        // テンプレートをセレクトボックスに追加
        templates.forEach(template => {
            const option = document.createElement("option");
            option.value = template;
            option.text = template;
            select.add(option);
        });
    } catch (error) {
        console.error('Failed to initialize templates:', error);
        // エラー時はデフォルトテンプレートを使用
        templates = noteStorage.getDefaultTemplates(1);
    }
    
    return select;
}

// その他の非同期関数の修正
async function addNote() {
    try {
        const player = document.querySelector("video");
        if (!player) return;

        const currentTime = player.currentTime;
        const timestamp = formatTimestamp(currentTime);
        const newNote = { 
            timestamp, 
            timestampInSeconds: currentTime, 
            text: "" 
        };
        
        notes.push(newNote);
        selectedNote = newNote;
        sortNotesByTimestamp();
        
        await noteStorage.saveNotes(notes);
        
        updateNotesUI();
        setTimeout(() => scrollToNewNote(timestamp), 100);
    } catch (error) {
        console.error('Failed to add note:', error);
        showToast('Failed to add note', 'error');
    }
}

// テンプレート編集機能を更新
async function editTemplates() {
    if (document.querySelector("#editContainer")) return;

    try {
        // 現在のプリセット番号を取得
        const currentPreset = await noteStorage.getCurrentPreset();
        // 現在のプリセットのテンプレートを読み込む
        const currentTemplates = await noteStorage.loadPresetTemplates(currentPreset);
        templates = currentTemplates; // グローバル変数を更新

        // オーバーレイの作成
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            zIndex: '10000',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
        });

        // 編集コンテナ
        const editContainer = document.createElement("div");
        editContainer.id = "editContainer";
        Object.assign(editContainer.style, {
            backgroundColor: currentTheme === 'light' ? '#ffffff' : '#000000',
            color: currentTheme === 'light' ? '#000000' : '#ffffff',
            padding: '20px',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
        });

        // ヘッダー
        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
        });

        const title = document.createElement('h3');
        title.textContent = `テンプレートを編集 (プリセット${currentPreset})`;
        Object.assign(title.style, {
            margin: '0',
            fontSize: '18px',
            fontWeight: '600'
        });

        header.appendChild(title);
        editContainer.appendChild(header);

        // テキストエリア
        const editTextArea = document.createElement("textarea");
        editTextArea.value = templates.join("\n");
        Object.assign(editTextArea.style, {
            width: '100%',
            minHeight: '300px',
            backgroundColor: currentTheme === 'light' ? '#f8f9fa' : '#16181c',
            color: currentTheme === 'light' ? '#000000' : '#ffffff',
            border: `1px solid ${currentTheme === 'light' ? '#dee2e6' : '#333639'}`,
            borderRadius: '8px',
            padding: '12px',
            resize: 'vertical',
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            lineHeight: '1.5',
            boxSizing: 'border-box'
        });
        editContainer.appendChild(editTextArea);

        // ボタンコンテナ
        const buttonContainer = document.createElement('div');
        Object.assign(buttonContainer.style, {
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            marginTop: '16px'
        });

        // キャンセルボタン
        const cancelButton = document.createElement("button");
        cancelButton.textContent = "キャンセル";
        Object.assign(cancelButton.style, {
            padding: '8px 16px',
            borderRadius: '8px',
            border: `1px solid ${currentTheme === 'light' ? '#dee2e6' : '#333639'}`,
            backgroundColor: 'transparent',
            color: currentTheme === 'light' ? '#000000' : '#ffffff',
            cursor: 'pointer',
            fontSize: '14px'
        });
        cancelButton.addEventListener('click', () => overlay.remove());

        // 保存ボタン
        const saveButton = document.createElement("button");
        saveButton.textContent = "保存";
        Object.assign(saveButton.style, {
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#1d9bf0',
            color: '#ffffff',
            cursor: 'pointer',
            fontSize: '14px'
        });

        saveButton.addEventListener("click", async () => {
            try {
                const newTemplates = editTextArea.value
                    .split("\n")
                    .map(template => template.trim())
                    .filter(template => template);

                // 現在のプリセットに保存
                await noteStorage.savePresetTemplates(currentPreset, newTemplates);
                
                // グローバル変数の更新
                templates = newTemplates;
                
                // セレクトボックスの更新
                const templateSelect = document.querySelector("select");
                if (templateSelect) {
                    updateTemplateSelect(templateSelect);
                }
                
                overlay.remove();
                showToast("テンプレートを保存しました", "success");
            } catch (error) {
                console.error('Failed to save templates:', error);
                showToast("テンプレートの保存に失敗しました", "error");
            }
        });

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(saveButton);
        editContainer.appendChild(buttonContainer);

        overlay.appendChild(editContainer);
        document.body.appendChild(overlay);

        // ESCキーでの閉じる
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') overlay.remove();
        });

    } catch (error) {
        console.error('Failed to initialize template editor:', error);
        showToast("テンプレートの読み込みに失敗しました", "error");
    }
}

// 初期化時にテンプレートを読み込む
async function initializeTemplates() {
    try {
        if (!noteStorage) {
            noteStorage = new NoteStorage();
            await noteStorage.initialize();
        }

        // 現在のプリセット番号を取得
        const currentPreset = await noteStorage.getCurrentPreset();
        console.log('Current preset:', currentPreset);

        // 現在のプリセットのテンプレートを読み込む
        const loadedTemplates = await noteStorage.loadPresetTemplates(currentPreset);
        console.log('Loaded templates:', loadedTemplates);

        // グローバル変数を更新
        templates = loadedTemplates;

        // セレクトボックスがあれば更新
        const templateSelect = document.querySelector("select");
        if (templateSelect) {
            updateTemplateSelect(templateSelect);
        }

        return templates;
    } catch (error) {
        console.error('Failed to initialize templates:', error);
        // エラー時はデフォルトテンプレートを使用
        templates = noteStorage.getDefaultTemplates(1);
        return templates;
    }
}


// 全ノートのコピー機能
function copyAllNotes() {
    notes.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const formattedText = notes.map(note => 
        `${note.timestamp} ${note.text}`
    ).join("\n");

    navigator.clipboard.writeText(formattedText)
        .then(() => showToast("All notes copied to clipboard!", "success"))
        .catch(err => {
            console.error("Could not copy notes to clipboard: ", err);
            showToast("Failed to copy notes to clipboard", "error");
        });
}

// テンプレート選択の更新関数を改善
function updateTemplateSelect(select) {
   if (!select) return;
   
   // 既存のオプションをクリア
   select.innerHTML = "";

   // 新しいテンプレートを追加
   templates.forEach(template => {
       const option = document.createElement("option");
       option.value = template;
       option.text = template;
       select.add(option);
   });
}

// X共有コンテンツ生成の改善
async function generateXShareContent(note) {
    const video = document.querySelector("video");
    if (!video) throw new Error('Video element not found');

    // タイトル取得と制限（25文字以内、改行なし）
    const fullVideoTitle = document.querySelector("h1.style-scope.ytd-watch-metadata")
        ?.textContent?.trim()
        .replace(/\s+/g, ' ') || '';
    const videoTitle = truncateText(fullVideoTitle, 35);

    // コメントの制限（50文字）
    const noteText = truncateText(note.text, 60);

    // URLの生成
    const videoUrl = await generateVideoUrl(note.timestamp);
    
    // コンテンツの組み立て（感情と行動を意識した構成）
    return {
        text: [
            // 1. 感情のこもったコメント（メイン）
            `💬 ${noteText}`,
            // 2. アクション喚起のURL
            `⏮️ ${videoUrl} (5s before)`,            
            '',  // 空行でセパレート

            // 3. コンテキストとしてのタイトル（サブ情報）
            `${note.timestamp} 🎯『${videoTitle}』`,
            
            // 4. コミュニティとの接続
            '#OshiMemoShare #推しメモシェア'
        ].join('\n'),
        timestamp: note.timestampInSeconds,
        titleLength: videoTitle.length,
        commentLength: noteText.length,
        originalTitle: videoTitle,
        originalComment: noteText
    };
}


async function createXSharePreview(note) {
    const lang = getPreferredLanguage();
    const t = translations[lang];
    const content = await generateXShareContent(note);
    const screenshot = await captureScreenshotAtTime(content.timestamp, document.querySelector("video"));
    
    const dialog = document.createElement('div');
    dialog.className = 'x-share-preview';
    Object.assign(dialog.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: currentTheme === 'light' ? '#ffffff' : '#000000',
        padding: '24px',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        zIndex: '10000',
        maxWidth: '600px',
        width: '90%'
    });

    // ヘッダー
    const header = document.createElement('div');
    Object.assign(header.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
    });

    // タイトル
    const title = document.createElement('h3');
    Object.assign(title.style, {
        color: currentTheme === 'light' ? '#000000' : '#ffffff',
        fontSize: '20px',
        fontWeight: '700',
        margin: '0'
    });
    title.textContent = t.sharePreview;

    // 閉じるボタン
    const closeButton = document.createElement('button');
    Object.assign(closeButton.style, {
        backgroundColor: 'transparent',
        border: 'none',
        color: currentTheme === 'light' ? '#666666' : '#71767b',  // 修正
        cursor: 'pointer',
        padding: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        transition: 'background-color 0.2s'
    });

    closeButton.innerHTML = '<span class="material-icons" style="font-size: 20px;">close</span>';
    
    closeButton.addEventListener('mouseenter', () => {
        closeButton.style.backgroundColor = currentTheme === 'light' ? 
            'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';  // 修正
    });

    closeButton.addEventListener('mouseleave', () => {
        closeButton.style.backgroundColor = 'transparent';
    });
    
    closeButton.addEventListener('click', () => dialog.remove());

    header.appendChild(title);
    header.appendChild(closeButton);
    dialog.appendChild(header);

    // スクリーンショットプレビュー
    const imgPreview = document.createElement('div');
    Object.assign(imgPreview.style, {
        marginBottom: '16px',
        borderRadius: '16px',
        overflow: 'hidden',
        border: `1px solid ${currentTheme === 'light' ? '#dee2e6' : '#333639'}`  // 修正
    });

    const img = document.createElement('img');
    img.src = screenshot;
    img.style.width = '100%';
    img.style.display = 'block';
    imgPreview.appendChild(img);
    dialog.appendChild(imgPreview);

    // テキストエディタコンテナ
    const editorContainer = document.createElement('div');
    Object.assign(editorContainer.style, {
        position: 'relative',
        marginBottom: '20px'
    });

    // テキストエディタ
    const editor = document.createElement('textarea');
    Object.assign(editor.style, {
        width: '100%',
        minHeight: '150px',
        padding: '12px',
        backgroundColor: currentTheme === 'light' ? '#f8f9fa' : '#16181c',
        border: `1px solid ${currentTheme === 'light' ? '#dee2e6' : '#333639'}`,
        borderRadius: '16px',
        color: currentTheme === 'light' ? '#000000' : '#ffffff',
        fontSize: '14px',
        lineHeight: '1.5',
        fontFamily: 'Arial, sans-serif',
        resize: 'vertical',
        boxSizing: 'border-box',
        outline: 'none'
    });
    editor.value = content.text;
    editor.spellcheck = false;

    // 文字数カウンター
    const counter = document.createElement('div');
    Object.assign(counter.style, {
        position: 'absolute',
        bottom: '12px',
        right: '12px',
        color: '#71767b',
        fontSize: '14px',
        padding: '4px 8px',
        borderRadius: '4px',
        backgroundColor: '#16181c',
        display: 'flex',
        alignItems: 'center',
        gap: '2px'
    });

    function updateCounter() {
        const count = countXCharacters(editor.value);
        const remaining = 280 - count;
        
        // 残り文字数に応じた色の決定
        const numberColor = remaining < 0 ? '#f4212e' : 
                           remaining < 20 ? '#ffd400' : 
                           currentTheme === 'light' ? '#1a73e8' : '#1d9bf0';
        
        // 背景色の更新
        counter.style.backgroundColor = currentTheme === 'light' ? '#f8f9fa' : '#16181c';
        
        // カウンターの内容更新
        counter.innerHTML = `
            <span style="color: ${numberColor}; font-weight: 600;">${remaining}</span>
            <span style="color: ${currentTheme === 'light' ? '#666666' : '#71767b'}; opacity: 0.7;">/280</span>
        `;

        // テキストエリアのボーダー色も更新
        editor.style.borderColor = remaining < 0 ? '#f4212e' : 
                                 currentTheme === 'light' ? '#dee2e6' : '#333639';
    }

    editor.addEventListener('input', updateCounter);
    editorContainer.appendChild(editor);
    editorContainer.appendChild(counter);
    dialog.appendChild(editorContainer);

    // シェア手順
    const instructions = document.createElement('div');
    Object.assign(instructions.style, {
        color: currentTheme === 'light' ? '#666666' : '#71767b',
        fontSize: '13px',
        marginBottom: '20px',
        padding: '12px',
        backgroundColor: currentTheme === 'light' ? '#f8f9fa' : '#16181c',
        borderRadius: '8px',
        lineHeight: '1.5'
    });
    instructions.innerHTML = `
        <div style="margin-bottom: 8px">${t.howToShare}</div>
        <div>1. ${t.step1}</div>
        <div>2. ${t.step2}</div>
    `;
    dialog.appendChild(instructions);

    // ボタンコンテナ
    const buttonContainer = document.createElement('div');
    Object.assign(buttonContainer.style, {
        display: 'flex',
        gap: '12px',
        justifyContent: 'flex-end',
        alignItems: 'center'
    });

    // ボタン共通スタイル
    const buttonStyle = {
        padding: '10px 20px',
        borderRadius: '9999px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '600',
        minWidth: '80px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        transition: 'background-color 0.2s'
    };

    // X投稿ボタン（メインアクション）
    const openXButton = document.createElement('button');
    openXButton.innerHTML = `
        <span class="material-icons" style="font-size: 20px;">send</span>
        ${t.shareToX}
    `;
    Object.assign(openXButton.style, {
        ...buttonStyle,
        backgroundColor: '#1d9bf0',
        color: '#ffffff',
        minWidth: '140px'
    });
    openXButton.addEventListener('mouseenter', () => {
        openXButton.style.backgroundColor = '#1a8cd8';
    });
    openXButton.addEventListener('mouseleave', () => {
        openXButton.style.backgroundColor = '#1d9bf0';
    });
    openXButton.addEventListener('click', async () => {
        const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(editor.value)}`;
        window.open(shareUrl, '_blank');
        showToast(t.openingX);
    });

    // 画像ダウンロードボタン（サブアクション）
    const downloadButton = document.createElement('button');
    downloadButton.innerHTML = `
        <span class="material-icons" style="font-size: 20px;">download</span>
        ${t.downloadImage}
    `;
    Object.assign(downloadButton.style, {
        ...buttonStyle,
        backgroundColor: 'transparent',
        border: `1px solid ${currentTheme === 'light' ? '#dee2e6' : '#333639'}`,
        color: currentTheme === 'light' ? '#000000' : '#ffffff'
    });

    downloadButton.addEventListener('mouseenter', () => {
        downloadButton.style.backgroundColor = currentTheme === 'light' ? 
            'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';  // 修正
    });

    downloadButton.addEventListener('mouseleave', () => {
        downloadButton.style.backgroundColor = 'transparent';
    });

    downloadButton.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = screenshot;
        link.download = `screenshot_${formatTimestamp(content.timestamp)}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(t.imageDownloaded);
    });

    buttonContainer.appendChild(downloadButton);
    buttonContainer.appendChild(openXButton);
    dialog.appendChild(buttonContainer);

    document.body.appendChild(dialog);
    updateCounter(); // 初期カウンターの表示
    editor.focus(); // エディタにフォーカス

    // ESCキーでの閉じる
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            dialog.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

// Xの文字数カウントルールに基づく改良版カウント関数
function countXCharacters(text) {
    // URLを一時的なプレースホルダーに置換（Xでは23文字とカウント）
    let processedText = text.replace(/https?:\/\/\S+/g, 'x'.repeat(23));
    
    // 改行を1文字としてカウント
    processedText = processedText.replace(/\n/g, 'x');
    
    // 文字種別ごとのカウント
    let count = 0;
    for (let char of processedText) {
        if (isFullWidth(char)) {
            // CJK文字（中国語、日本語、韓国語）など全角文字は2文字としてカウント
            count += 2;
        } else if (isEmoji(char)) {
            // 絵文字は2文字としてカウント
            count += 2;
        } else {
            // その他の文字（ASCII文字など）は1文字としてカウント
            count += 1;
        }
    }
    
    return count;
}

// 全角文字の判定
function isFullWidth(char) {
    // CJK統合漢字
    if (/[\u4E00-\u9FFF]/.test(char)) return true;
    // CJK統合漢字拡張A
    if (/[\u3400-\u4DBF]/.test(char)) return true;
    // ひらがな、カタカナ
    if (/[\u3040-\u30FF]/.test(char)) return true;
    // 全角記号、数字、アルファベット
    if (/[\uFF01-\uFF60]/.test(char)) return true;
    // CJK記号と句読点
    if (/[\u3000-\u303F]/.test(char)) return true;
    // 韓国語（ハングル）
    if (/[\uAC00-\uD7AF]/.test(char)) return true;
    
    return false;
}

// 絵文字の判定
function isEmoji(char) {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|\p{Emoji_Presentation}|\p{Extended_Pictographic}/u;
    return emojiRegex.test(char);
}


// シェアボタンの作成
function createShareButton(note) {
    const button = document.createElement("button");
    button.className = "share-button";
    button.innerHTML = '<span class="material-icons" style="font-size: 16px;">send</span>';
    button.title = "Share on X";
    styleIconButton(button);

    button.addEventListener("click", async (e) => {
        e.stopPropagation();
        createXSharePreview(note);
    });

    return button;
}

// アイコンボタンのスタイル設定
function styleIconButton(button) {
    Object.assign(button.style, {
        cursor: "pointer",
        backgroundColor: "transparent",
        border: "none",
        padding: "2px",
        color: currentTheme === 'light' ? '#1DA1F2' : '#1DA1F2',
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "20px",
        height: "20px",
        transition: "opacity 0.2s"
    });

    button.addEventListener("mouseenter", () => button.style.opacity = "0.8");
    button.addEventListener("mouseleave", () => button.style.opacity = "1");
}

// Helper functions...
function formatTimestamp(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// テキストの省略と文字数カウント
function truncateText(text, maxLength) {
    text = text.trim();
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1) + '…';
}

async function generateVideoUrl(timestamp) {
    const currentUrl = window.location.href;
    const videoId = new URL(currentUrl).searchParams.get('v');
    if (!videoId) return currentUrl;

    const timeComponents = timestamp.split(':').map(Number);
    const seconds = timeComponents.length === 3
        ? timeComponents[0] * 3600 + timeComponents[1] * 60 + timeComponents[2]
        : timeComponents[0] * 60 + timeComponents[1];

    return `https://youtu.be/${videoId}?t=${Math.max(0, seconds - 5)}`;
}


// updateNotesUI関数内でタイムスタンプ要素を作成する部分を修正
function createTimestamp(note) {
    const timestamp = document.createElement("span");
    timestamp.innerText = note.timestamp;
    timestamp.setAttribute('data-timestamp', 'true'); // 識別用の属性を追加
    timestamp.style.cursor = "pointer";
    timestamp.style.color = currentTheme === 'light' ? '#1a73e8' : '#7ab4ff';
    timestamp.style.textDecoration = "underline";
    timestamp.style.fontSize = "13px";
    timestamp.style.minWidth = "45px";
    timestamp.title = "Click to jump to this timestamp";

    // ホバーエフェクト
    timestamp.addEventListener("mouseenter", () => timestamp.style.opacity = "0.8");
    timestamp.addEventListener("mouseleave", () => timestamp.style.opacity = "1");

    // クリックイベント
    timestamp.addEventListener("click", () => {
        const video = document.querySelector("video");
        if (video) {
            const parts = note.timestamp.split(':').map(Number);
            const seconds = parts.length === 3 
                ? parts[0] * 3600 + parts[1] * 60 + parts[2]
                : parts[0] * 60 + parts[1];
            
            video.currentTime = seconds;
            video.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });

    return timestamp;
}

// テキストエリアの改善（ノートの見やすさ向上）
// テキストエリアを作成する関数を改善
function createNoteTextArea(note) {
    const parentDiv = document.createElement("div");
    Object.assign(parentDiv.style, {
        display: "flex",
        flex: "1",
        position: "relative",
        backgroundColor: currentTheme === 'light' ? '#fff' : '#2a2a2a'
    });

    const textarea = document.createElement("textarea");
    textarea.value = note.text;
    Object.assign(textarea.style, {
        width: "100%",
        minHeight: "20px",
        maxHeight: "60px",
        overflow: "hidden",
        marginLeft: "4px",
        marginRight: "4px",
        padding: "4px 8px",
        lineHeight: "20px",
        backgroundColor: currentTheme === 'light' ? '#fff' : '#16181c',
        color: currentTheme === 'light' ? '#000' : '#fff',
        border: `1px solid ${currentTheme === 'light' ? '#cfd9de' : '#333639'}`,
        borderRadius: "4px",
        resize: "none",
        fontSize: "14px",
        fontFamily: "Arial, sans-serif"
    });

    // 保存インジケータの追加
    const saveIndicator = createSaveIndicator();
    parentDiv.appendChild(saveIndicator);

    // イベントリスナーの設定
    textarea.addEventListener("input", () => {
        note.text = textarea.value;
        adjustHeight();
        triggerAutoSave(); // 自動保存をトリガー
    });

   // 自動リサイズ機能
   const adjustHeight = () => {
       textarea.style.height = "20px";
       const scrollHeight = textarea.scrollHeight;
       textarea.style.height = Math.min(scrollHeight, 60) + "px";
   };

   parentDiv.appendChild(textarea);
   return parentDiv;
}

// 3. Modified template insertion to trigger auto-save
function insertTemplate(note, template) {
    if (!note || !template) return;
    
    note.text = (note.text || '') + template;
    updateNotesUI();
    triggerAutoSave(); // Trigger auto-save after template insertion
}


// 3. ページ離脱時の保存確認
window.addEventListener('beforeunload', (e) => {
    if (autoSaveTimeout) {
        const message = '保存していない変更があります。ページを離れてもよろしいですか？';
        e.returnValue = message;
        return message;
    }
});

// 4. バックグラウンドへの切り替え時の即時保存
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
        executeAutoSave();
    }
});

// createDeleteButton 関数を修正
function createDeleteButton(note) {
    const button = document.createElement("button");
    button.className = "delete-button";
    button.innerHTML = '<span class="material-icons" style="font-size: 16px;">delete</span>';
    Object.assign(button.style, {
        cursor: "pointer",
        backgroundColor: "transparent",
        border: "none",
        padding: "2px",
        color: currentTheme === 'light' ? '#666' : '#999',
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "20px",
        height: "20px"
    });

    button.addEventListener("click", async () => {
        try {
            const noteIndex = notes.indexOf(note);
            if (noteIndex !== -1) {
                notes.splice(noteIndex, 1);
                await noteStorage.saveNotes(notes);
                updateNotesUI();
            }
        } catch (error) {
            console.error('Failed to delete note:', error);
            showToast('Failed to delete note', 'error');
        }
    });

    return button;
}

// ノート選択の設定
function setupNoteSelection(noteContainer, note) {
    noteContainer.addEventListener("click", (e) => {
        if (!e.target.closest('button') && e.target.tagName !== 'SPAN') {
            selectedNote = note;
            const allNotes = document.querySelectorAll(".note");
            allNotes.forEach(n => {
                n.style.backgroundColor = currentTheme === 'light' ? '#ffffff' : '#2a2a2a';
            });
            noteContainer.style.backgroundColor = currentTheme === 'light' 
                ? 'rgba(26, 115, 232, 0.1)' 
                : 'rgba(122, 180, 255, 0.1)';
        }
    });
}

// ホバーエフェクトの設定
function setupHoverEffect(noteContainer, note) {
    noteContainer.addEventListener("mouseenter", () => {
        if (selectedNote !== note) {
            noteContainer.style.backgroundColor = currentTheme === 'light' ? '#ffffff' : '#2a2a2a';
        }
    });
    
    noteContainer.addEventListener("mouseleave", () => {
        if (selectedNote !== note) {
            noteContainer.style.backgroundColor = currentTheme === 'light' ? '#ffffff' : '#2a2a2a';
        }
    });
}

// ノートをタイムコード順に並べ替える関数
function sortNotesByTimestamp() {
    notes.sort((a, b) => {
        const [aMinutes, aSeconds] = a.timestamp.split(':').map(Number);
        const [bMinutes, bSeconds] = b.timestamp.split(':').map(Number);
        return (aMinutes * 60 + aSeconds) - (bMinutes * 60 + bSeconds);
    });
}

// 1. シンプルなMaterial Icons初期化
function addMaterialIconsSupport() {
    // 既に読み込まれている場合は処理をスキップ
    if (document.querySelector('link[href*="Material+Icons"]')) {
        return;
    }

    // CSSの追加（必要最小限のスタイル）
    const style = document.createElement('style');
    style.textContent = `
        .material-icons {
            font-family: 'Material Icons';
            font-size: 20px;
            line-height: 1;
            display: inline-block;
            vertical-align: middle;
        }
    `;
    document.head.appendChild(style);

    // Material Iconsの読み込み
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
}

// 4. 初期化の簡略化
async function initializeMemoFeature() {
    if (isInitialized) return;
    
    try {
        addMaterialIconsSupport();
        await createMemoSidebar();
        isInitialized = true;
    } catch (error) {
        console.error('Failed to initialize memo feature:', error);
        isInitialized = false;
    }
}

// イベントリスナーの設定を改善
const initializeListener = async () => {
    isInitialized = false;
    clearTimeout(navigationTimeout);
    navigationTimeout = setTimeout(async () => {
        await initializeMemoFeature();
    }, 1000);
};

// 5. ページロード時の初期化
document.addEventListener("DOMContentLoaded", initializeMemoFeature);
window.addEventListener("yt-navigate-finish", initializeListener);

// スクリーンショット機能の修正
async function captureScreenshotAtTime(time, video) {
    return new Promise((resolve, reject) => {
        // 元の状態を保存
        const originalTime = video.currentTime;
        const wasPlaying = !video.paused;
        if (wasPlaying) {
            video.pause();
        }

        const timeoutDuration = 2000;
        let timeoutId;

        const handleSeeked = async () => {
            try {
                clearTimeout(timeoutId);
                video.removeEventListener('seeked', handleSeeked);

                // フレームが完全に描画されるのを待つ
                await new Promise(resolve => setTimeout(resolve, 100));

                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                const screenshot = canvas.toDataURL('image/png');

                // 元の状態に復元
                video.currentTime = originalTime;
                if (wasPlaying) {
                    await video.play();
                }

                resolve(screenshot);
            } catch (error) {
                reject(error);
            }
        };

        timeoutId = setTimeout(() => {
            video.removeEventListener('seeked', handleSeeked);
            reject(new Error(`Screenshot capture timed out at ${time}s`));
        }, timeoutDuration);

        video.addEventListener('seeked', handleSeeked, { once: true });
        video.currentTime = time;
    });
}

// タイムスタンプを秒数に変換する関数
function convertTimestampToSeconds(timestamp) {
    const parts = timestamp.split(':').map(Number);
    if (parts.length === 3) {
        // HH:MM:SS 形式
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        // MM:SS 形式
        return parts[0] * 60 + parts[1];
    } else {
        return NaN; // 無効なタイムスタンプ
    }
}

// ノートからタイムコードを取得して秒数に変換
const timecodes = notes.map(note => {
    if (note.timestampInSeconds) {
        return note.timestampInSeconds;  // 秒数が既にある場合
    } else {
        return convertTimestampToSeconds(note.timestamp);  // タイムスタンプから秒数に変換
    }
});


// ダウンロードボタンのクリックイベントに関連付ける
const downloadButton = document.createElement("button");
downloadButton.innerHTML = '<span class="material-icons">download_for_offline</span>';
downloadButton.style.cursor = "pointer";
downloadButton.style.marginLeft = "5px";
downloadButton.addEventListener("click", () => {
    const timecodes = notes.map(note => note.timestampInSeconds); // タイムコードを秒で取得
    downloadScreenshotsAsZip(timecodes);  // ここで関数を呼び出す
});

// クリップボード処理の修正
async function copyImageAndText(screenshot, text) {
    try {
        const response = await fetch(screenshot);
        const blob = await response.blob();

        // モダンブラウザ用の処理
        if (navigator.clipboard?.write) {
            const clipboardItems = [
                new ClipboardItem({
                    [blob.type]: blob,
                    'text/plain': new Blob([text], { type: 'text/plain' })
                })
            ];
            await navigator.clipboard.write(clipboardItems);
        } else {
            // フォールバック：テキストのみコピー
            const tempTextArea = document.createElement('textarea');
            tempTextArea.value = text;
            document.body.appendChild(tempTextArea);
            tempTextArea.select();
            document.execCommand('copy');
            document.body.removeChild(tempTextArea);
            showToast('Content copied! (Screenshot copying not supported in your browser)');
        }
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        // エラー時はテキストだけでもコピーを試みる
        await navigator.clipboard.writeText(text);
        showToast('Content copied! (Screenshot copying failed)');
    }
}

// 一括ダウンロード用の関数群 -------------------------------------
async function downloadScreenshotsAsZip(timecodes) {
    try {
        const video = document.querySelector('video');
        if (!video) {
            throw new Error('Video element not found');
        }

        // JSZipの読み込みを確認
        await ensureJSZipLoaded();

        // 元の再生状態を保存
        const wasPlaying = !video.paused;
        const originalTime = video.currentTime;
        video.pause();

        const zip = new JSZip();
        let processedCount = 0;
        const totalCount = timecodes.length;

        // モダンなプログレスバーの作成
        const progressOverlay = createProgressOverlay(totalCount);
        document.body.appendChild(progressOverlay);

        // 各タイムコードを処理
        for (let i = 0; i < timecodes.length; i++) {
            const time = timecodes[i];
            try {
                // スクリーンショットの取得（タイムアウト付き）
                const screenshot = await Promise.race([
                    captureScreenshotAtTime(time, video),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Screenshot timeout')), 5000)
                    )
                ]);

                const imgData = screenshot.split(',')[1];
                const filename = `screenshot_${String(i + 1).padStart(3, '0')}_${formatTime(time)}.png`;
                zip.file(filename, imgData, { base64: true });
                
                // プログレス更新
                processedCount++;
                updateProgressBar(progressOverlay, processedCount, totalCount);

            } catch (error) {
                console.error(`Failed to capture screenshot at ${formatTime(time)}:`, error);
                showToast(`Skipped screenshot at ${formatTime(time)}`, 'warning');
            }
        }

        // ZIPファイルの生成と保存
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `youtube_screenshots_${formatDate()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // クリーンアップ
        progressOverlay.remove();
        video.currentTime = originalTime;
        if (wasPlaying) {
            await video.play();
        }

        showToast('Screenshots downloaded successfully!', 'success');
        
    } catch (error) {
        console.error('Screenshot download failed:', error);
        showToast('Failed to download screenshots. Please try again.', 'error');
    }
}

// JSZipの読み込みを確認
function ensureJSZipLoaded() {
    return new Promise((resolve, reject) => {
        if (typeof JSZip !== 'undefined') {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('jszip.min.js');
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load JSZip'));
        document.head.appendChild(script);
    });
}

// モダンなプログレスオーバーレイの作成
function createProgressOverlay(totalCount) {
    const overlay = document.createElement('div');
    overlay.className = 'screenshot-progress-overlay';
    Object.assign(overlay.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: currentTheme === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.95)',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: '10000',
        minWidth: '300px',
        textAlign: 'center'
    });

    overlay.innerHTML = `
        <div style="color: ${currentTheme === 'light' ? '#000' : '#fff'}; margin-bottom: 15px; font-weight: 500;">
            Capturing Screenshots: <span class="progress-count">0</span>/${totalCount}
        </div>
        <div style="
            width: 100%;
            height: 4px;
            background: ${currentTheme === 'light' ? '#eee' : '#333'};
            border-radius: 2px;
            overflow: hidden;
        ">
            <div class="progress-bar" style="
                width: 0%;
                height: 100%;
                background: #1DA1F2;
                transition: width 0.3s ease;
            "></div>
        </div>
    `;

    return overlay;
}

// プログレスバーの更新
function updateProgressBar(overlay, current, total) {
    const progressBar = overlay.querySelector('.progress-bar');
    const progressCount = overlay.querySelector('.progress-count');
    const percentage = (current / total) * 100;
    
    progressBar.style.width = `${percentage}%`;
    progressCount.textContent = current;
}

// 時間のフォーマット
function formatTime(seconds) {
    const date = new Date(null);
    date.setSeconds(seconds);
    return date.toISOString().substr(11, 8).replace(/:/g, '-');
}

// 日付のフォーマット
function formatDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    return `${year}${month}${day}_${hour}${minute}`;
}

// 保存確認のトースト表示を改善
function showToast(message, type = 'info') {
    if (!document.querySelector('.toast-container')) {
        const container = document.createElement('div');
        container.className = 'toast-container';
        Object.assign(container.style, {
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: '10000'
        });
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    Object.assign(toast.style, {
        backgroundColor: 
            type === 'error' ? '#dc3545' : 
            type === 'warning' ? '#ffc107' :
            type === 'success' ? '#28a745' : '#007bff',
        color: '#fff',
        padding: '12px 24px',
        borderRadius: '8px',
        marginBottom: '8px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
        animation: 'fadeInOut 3s ease forwards'
    });

    toast.textContent = message;
    document.querySelector('.toast-container').appendChild(toast);

    setTimeout(() => {
        toast.remove();
        if (!document.querySelector('.toast-container').hasChildNodes()) {
            document.querySelector('.toast-container').remove();
        }
    }, 3000);
}

// ------------------------------------------------------------

// 多言語対応の拡充
const translations = {
    en: {
        sharePreview: 'Share Preview',
        shareToX: 'Share to X',
        downloadImage: 'Download image',
        characterLimit: 'character limit',
        howToShare: 'How to share:',
        step1: 'Share text to X',
        step2: 'Download and attach image (optional)',
        openingX: 'Opening X...',
        imageDownloaded: 'Image downloaded!'
    },
    ja: {
        sharePreview: 'シェアプレビュー',
        shareToX: 'Xに送る',
        downloadImage: '画像を保存',
        characterLimit: '文字まで',
        howToShare: 'シェア方法：',
        step1: 'テキストをXに送信',
        step2: '必要に応じて画像を保存して添付',
        openingX: 'Xを開いています...',
        imageDownloaded: '画像を保存しました！'
    }
};

// 言語の取得
function getPreferredLanguage() {
    const browserLang = navigator.language.split('-')[0];
    return translations[browserLang] ? browserLang : 'en';
}

// ------------------------------------------------------------

// 保存済み動画の管理機能を追加



// デバッグ用のログ関数
function debugLog(message, data = null) {
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[YouTube Notes Debug] ${message}`, data || '');
    }
}


// showVideoManager 関数を修正
async function showVideoManager() {
    try {
        // ─── 初期化と基本データの取得 ───────
        if (!noteStorage) {
            noteStorage = new NoteStorage();
            await noteStorage.initialize();
        }

        const videos = await noteStorage.loadSavedVideos();
        console.log('Loaded saved videos:', videos);

        if (!videos || videos.length === 0) {
            showToast('保存された動画はありません', 'info');
            return;
        }

        const retentionDays = await noteStorage.getRetentionDays();
        const ITEMS_PER_PAGE = 5;
        let currentPage = 1;

        // ─── ベースコンテナの作成 ───────
        // オーバーレイの作成
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            zIndex: '10000',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
        });

        // メインコンテナ
        const mainContainer = document.createElement('div');
            Object.assign(mainContainer.style, {
            backgroundColor: currentTheme === 'light' ? '#ffffff' : '#000000',
            color: currentTheme === 'light' ? '#000000' : '#ffffff',
            padding: '24px',
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            width: '90%',
            maxWidth: '800px',
            maxHeight: '80vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        });

        // ─── ヘッダーセクション ───────
        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            paddingBottom: '16px',
            borderBottom: `1px solid ${currentTheme === 'light' ? '#eee' : '#333'}`
        });

        // タイトルと一括削除ボタンを含むコンテナ
        const titleContainer = document.createElement('div');
        Object.assign(titleContainer.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            gap: '16px'
        });

        // タイトル
        const title = document.createElement('h2');
        title.textContent = '保存済み動画';
        Object.assign(title.style, {
            margin: '0',
            fontSize: '20px',
            fontWeight: '700',
            color: currentTheme === 'light' ? '#000' : '#fff'
        });

        // 閉じるボタン
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '<span class="material-icons">close</span>';
        Object.assign(closeButton.style, {
            backgroundColor: 'transparent',
            border: 'none',
            color: currentTheme === 'light' ? '#666' : '#fff',
            cursor: 'pointer',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%'
        });
        closeButton.addEventListener('click', () => overlay.remove());


        // ─── ヘッダーセクション ───────の組み立て
        titleContainer.appendChild(title);
        titleContainer.appendChild(closeButton);
        header.appendChild(titleContainer);
        mainContainer.appendChild(header);


        // ─── 検索と操作セクション ───────
        // トップコントロール
        const topControls = document.createElement('div');
        Object.assign(topControls.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px',
            padding: '0 0 16px 0',
            borderBottom: `1px solid ${currentTheme === 'light' ? '#eee' : '#333'}`
        });

        // 検索とボタンのコンテナ
        const searchButtonsContainer = document.createElement('div');
        Object.assign(searchButtonsContainer.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flex: '1'
        });

        // 検索窓
        const searchWrapper = document.createElement('div');
        Object.assign(searchWrapper.style, {
            position: 'relative',
            flex: '1',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        });

        // 検索アイコン
        const searchIcon = document.createElement('span');
        searchIcon.className = 'material-icons';
        searchIcon.textContent = 'search';
        Object.assign(searchIcon.style, {
            position: 'absolute',
            left: '12px',
            color: currentTheme === 'light' ? '#666' : '#999',
            fontSize: '20px'
        });

        // 検索欄
        const searchInput = document.createElement('input');
        Object.assign(searchInput.style, {
            width: '100%',
            padding: '8px 12px 8px 40px',
            borderRadius: '8px',
            border: `1px solid ${currentTheme === 'light' ? '#ccc' : '#333'}`,
            backgroundColor: currentTheme === 'light' ? '#fff' : '#111',
            color: currentTheme === 'light' ? '#000' : '#fff'
        });
        searchInput.placeholder = 'タイトルまたはメモ内容で検索...';

        // クリアボタン
        const clearButton = document.createElement('button');
        clearButton.innerHTML = '<span class="material-icons">close</span>';
        Object.assign(clearButton.style, {
            position: 'absolute',
            right: '8px',
            backgroundColor: 'transparent',
            border: 'none',
            color: currentTheme === 'light' ? '#666' : '#999',
            cursor: 'pointer',
            display: 'none', // 初期状態は非表示
            padding: '4px'
        });
        clearButton.addEventListener('click', () => {
            searchInput.value = '';
            clearButton.style.display = 'none';
            handleSearch();
        });


        // 一括削除ボタン
        const deleteAllButton = document.createElement('button');
        deleteAllButton.innerHTML = '<span class="material-icons">delete_sweep</span> Delete All';
        Object.assign(deleteAllButton.style, {
            backgroundColor: '#dc3545',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
        });

        // 一括削除ボタンのホバーエフェクト
        deleteAllButton.addEventListener('mouseenter', () => {
            deleteAllButton.style.backgroundColor = '#c82333';
        });
        deleteAllButton.addEventListener('mouseleave', () => {
            deleteAllButton.style.backgroundColor = '#dc3545';
        });

        // 一括削除の処理
        deleteAllButton.addEventListener('click', async () => {
            if (confirm('すべての保存済みメモを削除してもよろしいですか？\nこの操作は取り消せません。')) {
                try {
                    await noteStorage.clearAllNotes();
                    overlay.remove();
                    showToast('すべてのメモを削除しました', 'success');
                } catch (error) {
                    showToast('削除に失敗しました', 'error');
                }
            }
        });

        // ─── 保存期間設定セクション ───────
        const retentionInfo = document.createElement('div');
        Object.assign(retentionInfo.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            color: currentTheme === 'light' ? '#666' : '#999'
        });

        const retentionLabel = document.createElement('span');
        retentionLabel.textContent = `保存期間: ${retentionDays}日`;

        // 編集アイコンのスタイル修正
        const editRetentionButton = document.createElement('button');
        editRetentionButton.innerHTML = '<span class="material-icons">edit</span>';
        editRetentionButton.title = '保存期間を変更';
        Object.assign(editRetentionButton.style, {
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: currentTheme === 'light' ? '#1a73e8' : '#7ab4ff', // 色を変更
            display: 'flex',
            alignItems: 'center'
        });
        editRetentionButton.addEventListener('mouseenter', () => {
            editRetentionButton.style.backgroundColor = currentTheme === 'light' ? '#f0f0f0' : '#333';
        });
        editRetentionButton.addEventListener('mouseleave', () => {
            editRetentionButton.style.backgroundColor = 'transparent';
        });

        editRetentionButton.addEventListener('click', async () => {
            const newDays = prompt(`保存期間を入力してください（7-365日）`, retentionDays);
            if (newDays) {
                const days = parseInt(newDays);
                if (!isNaN(days) && days >= 7 && days <= 365) {
                    await noteStorage.setRetentionDays(days);
                    retentionLabel.textContent = `保存期間: ${days}日`;
                    showToast('保存期間を更新しました', 'success');
                } else {
                    showToast('7-365日の範囲で入力してください', 'error');
                }
            }
        });


        // ─── リストとページネーションセクション ───────
        // リストコンテナ
        const listContainer = document.createElement('div');
        Object.assign(listContainer.style, {
            flex: '1',
            overflowY: 'auto',
            padding: '8px',
            backgroundColor: currentTheme === 'light' ? '#f8f8f8' : '#111',
            borderRadius: '8px'
        });

        // ページネーション機能
        const paginationContainer = document.createElement('div');
        Object.assign(paginationContainer.style, {
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '16px'
        });


        // ─── 検索機能の実装 ───────
        const handleSearch = debounce(() => {
            const query = searchInput.value.toLowerCase();
            const filteredVideos = videos.filter(video => {
                const titleMatch = video.title?.toLowerCase().includes(query);
                const notes = video.notes || [];
                const notesMatch = notes.some(note => 
                    note.text?.toLowerCase().includes(query)
                );
                return titleMatch || notesMatch;
            });
            currentPage = 1;
            updateVideoList(listContainer, filteredVideos);
            clearButton.style.display = query ? 'block' : 'none';
        }, 300);


        // ─── リスト更新機能の実装 ───────
        function updateVideoList(container, filteredVideos) {
            const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
            const endIndex = startIndex + ITEMS_PER_PAGE;
            const pageVideos = filteredVideos.slice(startIndex, endIndex);
            
            // リストの更新
            container.innerHTML = '';
            pageVideos.forEach(video => {
                if (!video) return;
                const videoItem = createVideoListItem(video);
                container.appendChild(videoItem);
            });

            // ページネーションの更新
            updatePagination(filteredVideos);

            if (filteredVideos.length === 0) {
                const noResults = document.createElement('div');
                noResults.textContent = '検索結果が見つかりません';
                Object.assign(noResults.style, {
                    textAlign: 'center',
                    padding: '20px',
                    color: '#666'
                });
                container.appendChild(noResults);
            }
        }

        function updatePagination(filteredVideos) {
            const totalPages = Math.ceil(filteredVideos.length / ITEMS_PER_PAGE);
            paginationContainer.innerHTML = '';

            if (totalPages > 1) {
                // 前へボタン
                const prevButton = document.createElement('button');
                prevButton.innerHTML = '<span class="material-icons">chevron_left</span>';
                prevButton.disabled = currentPage === 1;
                prevButton.addEventListener('click', () => {
                    if (currentPage > 1) {
                        currentPage--;
                        updateVideoList(listContainer, filteredVideos);
                    }
                });

                // 後へボタン
                const nextButton = document.createElement('button');
                nextButton.innerHTML = '<span class="material-icons">chevron_right</span>';
                nextButton.disabled = currentPage === totalPages;
                nextButton.addEventListener('click', () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        updateVideoList(listContainer, filteredVideos);
                    }
                });

                // ページ番号
                const pageInfo = document.createElement('span');
                pageInfo.textContent = `${currentPage} / ${totalPages}`;

                [prevButton, pageInfo, nextButton].forEach(el => {
                    Object.assign(el.style, {
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: `1px solid ${currentTheme === 'light' ? '#ccc' : '#333'}`,
                        backgroundColor: currentTheme === 'light' ? '#fff' : '#111',
                        color: currentTheme === 'light' ? '#000' : '#fff'
                    });
                    paginationContainer.appendChild(el);
                });
            }
        }


        // ─── 最終組み立てと初期化 ───────
        // メインコンテナへの追加
        mainContainer.appendChild(header);
        mainContainer.appendChild(topControls);
        mainContainer.appendChild(listContainer);
        mainContainer.appendChild(paginationContainer);

        // 保存期間情報の組み立て
        retentionInfo.appendChild(retentionLabel);
        retentionInfo.appendChild(editRetentionButton);

        // 検索関連の要素を searchWrapper に追加
        searchWrapper.appendChild(searchIcon);
        searchWrapper.appendChild(searchInput);
        searchWrapper.appendChild(clearButton);

        // 検索コンテナの組み立て
        searchButtonsContainer.appendChild(searchWrapper);
        searchButtonsContainer.appendChild(deleteAllButton);

        // トップコントロールの組み立て
        topControls.appendChild(searchButtonsContainer);
        topControls.appendChild(retentionInfo);

        // オーバーレイへの追加と表示
        overlay.appendChild(mainContainer);
        document.body.appendChild(overlay);

        // 初期表示とイベントリスナー設定
        updateVideoList(listContainer, videos);
        searchInput.addEventListener('input', handleSearch);

        // Escボタンで閉じる
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') overlay.remove();
        });

    } catch (error) {
        console.error('Failed to show video manager:', error);
        showToast('動画一覧の読み込みに失敗しました', 'error');
    }
}


// デバウンス関数を追加（パフォーマンス最適化用）
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}


// デバッグ用のログ関数を追加
function debugLog(message, data = null) {
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[YouTube Notes Debug] ${message}`, data || '');
    }
}

// createVideoListItem 関数を改善
function createVideoListItem(video) {
    const item = document.createElement('div');
    Object.assign(item.style, {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '16px',
        borderRadius: '8px',
        backgroundColor: currentTheme === 'light' ? '#fff' : '#2a2a2a',
        marginBottom: '8px',
        transition: 'background-color 0.2s'
    });

    // メインコンテンツのラッパー
    const mainContent = document.createElement('div');
    Object.assign(mainContent.style, {
        display: 'flex',
        gap: '16px',
        flex: 1
    });

    // サムネイル
    const thumbnail = document.createElement('img');
    thumbnail.src = video.thumbnail;
    thumbnail.loading = 'lazy'; // 遅延読み込みを追加
    Object.assign(thumbnail.style, {
        width: '160px',
        height: '90px',
        borderRadius: '8px',
        objectFit: 'cover'
    });

    // 情報コンテナ
    const info = document.createElement('div');
    Object.assign(info.style, {
        flex: '1',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    });

    // タイトルリンク
    const titleLink = document.createElement('a');
    titleLink.href = `https://www.youtube.com/watch?v=${video.id}`;
    titleLink.textContent = video.title;
    Object.assign(titleLink.style, {
        color: currentTheme === 'light' ? '#000' : '#fff',
        textDecoration: 'none',
        fontSize: '16px',
        fontWeight: '600',
        lineHeight: '1.4',
        display: 'block',
        marginBottom: '4px',
        cursor: 'pointer'
    });

    // クリックイベントを追加
    titleLink.addEventListener('click', (e) => {
        e.preventDefault(); // デフォルトの動作をキャンセル
        window.location.href = `https://www.youtube.com/watch?v=${video.id}`;
    });

    // メモ情報
    const notesInfo = document.createElement('div');
    Object.assign(notesInfo.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
    });

    // メモ件数
    const noteCount = document.createElement('div');
    const validNotes = video.notes?.filter(note => note.text?.trim()) || [];
    noteCount.textContent = `${validNotes.length} メモ`;
    Object.assign(noteCount.style, {
        fontSize: '14px',
        fontWeight: '500',
        color: currentTheme === 'light' ? '#1a73e8' : '#7ab4ff'
    });
    
    // メモプレビュー
    if (video.notes && video.notes.length > 0) {
        const notesPreview = document.createElement('div');
        Object.assign(notesPreview.style, {
            fontSize: '14px',
            color: currentTheme === 'light' ? '#444' : '#ccc',
            lineHeight: '1.5',
            marginTop: '4px'
        });

        // メモ本文の結合（最大15個まで）
        const previewText = video.notes
            .slice(0, 15)
            .map(note => note.text.trim())
            .filter(text => text)
            .join(' / ');
            
        notesPreview.textContent = previewText;

        if (video.notes.length > 15) {
            const remainingCount = video.notes.length - 15;
            const hiddenNotesText = document.createElement('span');
            Object.assign(hiddenNotesText.style, {
                color: currentTheme === 'light' ? '#666' : '#999',
                fontSize: '13px',
                marginLeft: '4px'
            });
            hiddenNotesText.textContent = `(他 ${remainingCount}件)`;
            notesPreview.appendChild(hiddenNotesText);
        }

        notesInfo.appendChild(noteCount);
        notesInfo.appendChild(notesPreview);
    }

    // 削除ボタン
    const deleteButton = document.createElement('button');
    deleteButton.innerHTML = '<span class="material-icons">delete</span>';
    Object.assign(deleteButton.style, {
        backgroundColor: 'transparent',
        border: 'none',
        color: currentTheme === 'light' ? '#666' : '#999',
        cursor: 'pointer',
        padding: '8px',
        display: 'flex',
        alignItems: 'flex-start',
        transition: 'color 0.2s'
    });
    deleteButton.title = 'この動画のメモを削除';

    // ホバーエフェクト
    item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = currentTheme === 'light' ? '#f8f9fa' : '#2a2a2a';
        deleteButton.style.color = currentTheme === 'light' ? '#dc3545' : '#ff4d4d';
    });
    item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = currentTheme === 'light' ? '#fff' : '#2a2a2a';
        deleteButton.style.color = currentTheme === 'light' ? '#666' : '#999';
    });

    // 削除機能
    deleteButton.addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete this video note?')) {
            try {
                await noteStorage.deleteVideo(video.id);
                item.style.animation = 'fadeOut 0.3s';
                setTimeout(() => item.remove(), 300);
                showToast('メモを削除しました', 'success');
            } catch (error) {
                showToast('削除に失敗しました', 'error');
            }
        }
    });

    info.appendChild(titleLink);
    info.appendChild(notesInfo);
    mainContent.appendChild(thumbnail);
    mainContent.appendChild(info);
    item.appendChild(mainContent);
    item.appendChild(deleteButton);

    return item;
}

// アニメーション用のスタイルを追加
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInOut {
        0% { opacity: 0; transform: translateY(20px); }
        10% { opacity: 1; transform: translateY(0); }
        90% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-20px); }
    }
`;
document.head.appendChild(style);

// 自動保存のステータスを表示するインジケータを作成
function createSaveIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'saveIndicator';
    Object.assign(indicator.style, {
        position: 'absolute',
        right: '8px',
        bottom: '8px',
        fontSize: '12px',
        padding: '4px 8px',
        borderRadius: '4px',
        opacity: '0',
        transition: 'opacity 0.3s ease',
        backgroundColor: currentTheme === 'light' ? '#f8f9fa' : '#2a2a2a',
        color: currentTheme === 'light' ? '#666' : '#999',
        pointerEvents: 'none'
    });
    return indicator;
}

// 保存状態の表示を更新
function updateSaveStatus(status, isError = false) {
    const indicator = document.getElementById('saveIndicator');
    if (!indicator) return;

    indicator.style.opacity = '1';
    indicator.textContent = status;
    indicator.style.backgroundColor = isError ? 
        (currentTheme === 'light' ? '#fee' : '#400') : 
        (currentTheme === 'light' ? '#f8f9fa' : '#2a2a2a');
    indicator.style.color = isError ?
        (currentTheme === 'light' ? '#d00' : '#f66') :
        (currentTheme === 'light' ? '#666' : '#999');

    // 成功時は徐々にフェードアウト
    if (!isError) {
        setTimeout(() => {
            indicator.style.opacity = '0';
        }, 2000);
    }
}

// 自動保存の実行処理
async function executeAutoSave() {
    if (isSaving) return;
    
    try {
        isSaving = true;
        const currentContent = JSON.stringify(notes);
        
        // Skip if content hasn't changed
        if (currentContent === lastSavedContent) {
            return;
        }

        updateSaveStatus('Saving...');
        await noteStorage.saveNotes(notes);
        lastSavedContent = currentContent;
        updateSaveStatus('Saved');
        
    } catch (error) {
        console.error('Auto save failed:', error);
        updateSaveStatus('Save failed', true);
        
        // Reset last saved content on error to trigger retry
        lastSavedContent = '';
        
    } finally {
        isSaving = false;
    }
}


// デバウンス処理付きの自動保存関数
function triggerAutoSave() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(executeAutoSave, 2000); // 2秒後に保存
}






// 削除候補------------------------------------------------------------



