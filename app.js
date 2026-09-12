// Your Web App's Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyANmchJhDISP4ShLrQbPjg1qiobv_CP5l8",
  authDomain: "vtube-4a30c.firebaseapp.com",
  projectId: "vtube-4a30c",
  storageBucket: "vtube-4a30c.firebasestorage.app",
  messagingSenderId: "85188093936",
  appId: "1:85188093936:web:0922618a8802420ace1f35",
  measurementId: "G-9JWRB3K10Z"
};

// Initialize Firebase Services
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

let currentUser = null;

// Google Authentication - Login
function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(error => alert(error.message));
}

// Logout Function
function logout() {
    auth.signOut();
}

// Auth State Observer
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('loginBtn').style.display = 'none';
        document.getElementById('logoutBtn').style.display = 'inline-block';
        document.getElementById('uploadBox').style.display = 'block';
        
        setupUserData(user);
    } else {
        currentUser = null;
        document.getElementById('loginBtn').style.display = 'inline-block';
        document.getElementById('logoutBtn').style.display = 'none';
        document.getElementById('uploadBox').style.display = 'none';
        document.getElementById('profileSection').innerHTML = '<p>Please login first.</p>';
    }
    loadVideos();
});

function setupUserData(user) {
    const userRef = db.collection('users').doc(user.uid);

    userRef.get().then(doc => {
        if (!doc.exists) {
            userRef.set({
                uid: user.uid,
                name: user.displayName,
                email: user.email,
                followers: [],
                isMonetized: false
            });
        }
        renderUserProfile(user.uid);
    });
}

function renderUserProfile(userId) {
    db.collection('users').doc(userId).onSnapshot(doc => {
        if (!doc.exists) return;
        const data = doc.data();
        const followerCount = data.followers ? data.followers.length : 0;
        const canMonetize = followerCount >= 1000;

        let monetizationHTML = '';
        if (data.isMonetized) {
            monetizationHTML = '<p class="monetize-badge">✔ Channel Monetized</p>';
        } else if (canMonetize) {
            monetizationHTML = `<button onclick="applyMonetization('${userId}')">Apply for Monetization</button>`;
        } else {
            monetizationHTML = `<p style="font-size:12px; color:#888;">Monetization Progress: ${followerCount}/1000 Followers</p>`;
        }

        document.getElementById('profileSection').innerHTML = `
            <h4>${data.name}</h4>
            <p>Followers: <strong>${followerCount}</strong></p>
            ${monetizationHTML}
        `;
    });
}

// Upload Video & Thumbnail with Realtime Progress
async function uploadVideo() {
    const title = document.getElementById('videoTitle').value;
    const desc = document.getElementById('videoDesc').value;
    const videoFile = document.getElementById('videoFile').files[0];
    const thumbnailFile = document.getElementById('thumbnailFile').files[0];
    const uploadBtn = document.getElementById('uploadBtn');
    
    const progressContainer = document.getElementById('uploadProgressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    const status = document.getElementById('uploadStatus');

    if (!title || !videoFile || !thumbnailFile) {
        alert('Please fill in the title, select a video file, AND a thumbnail image!');
        return;
    }

    // Disable button & Show Progress UI
    uploadBtn.disabled = true;
    progressContainer.style.display = 'flex';
    status.innerText = '';
    progressBar.style.width = '0%';
    progressPercent.innerText = 'Uploading: 0%';

    try {
        // 1. Upload Thumbnail Image
        const thumbRef = storage.ref(`thumbnails/${Date.now()}_${thumbnailFile.name}`);
        const thumbSnapshot = await thumbRef.put(thumbnailFile);
        const thumbnailUrl = await thumbSnapshot.ref.getDownloadURL();

        // 2. Upload Video File with Live Progress Tracking
        const videoRef = storage.ref(`videos/${Date.now()}_${videoFile.name}`);
        const uploadTask = videoRef.put(videoFile);

        uploadTask.on('state_changed', 
            (snapshot) => {
                // Progress Percentage Calculation
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                const roundedProgress = Math.round(progress);
                
                progressBar.style.width = roundedProgress + '%';
                progressPercent.innerText = `Uploading Video: ${roundedProgress}%`;
            },
            (error) => {
                status.innerText = "Upload Failed: " + error.message;
                uploadBtn.disabled = false;
                progressContainer.style.display = 'none';
            },
            async () => {
                // 100% Upload Complete -> Save to Firestore Database
                const videoUrl = await uploadTask.snapshot.ref.getDownloadURL();

                await db.collection('videos').add({
                    title: title,
                    description: desc,
                    videoUrl: videoUrl,
                    thumbnailUrl: thumbnailUrl,
                    uploaderId: currentUser.uid,
                    uploaderName: currentUser.displayName,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    comments: []
                });

                status.innerText = "🎉 Video & Thumbnail Uploaded Successfully!";
                uploadBtn.disabled = false;
                progressContainer.style.display = 'none';

                // Reset form fields
                document.getElementById('videoTitle').value = '';
                document.getElementById('videoDesc').value = '';
                document.getElementById('videoFile').value = '';
                document.getElementById('thumbnailFile').value = '';
            }
        );
    } catch (err) {
        status.innerText = "Error: " + err.message;
        uploadBtn.disabled = false;
        progressContainer.style.display = 'none';
    }
}

// Load Videos Feed with Thumbnail Support
function loadVideos() {
    db.collection('videos').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        const feed = document.getElementById('videoFeed');
        feed.innerHTML = '';

        snapshot.forEach(doc => {
            const video = doc.data();
            const videoId = doc.id;

            feed.innerHTML += `
                <div class="video-card">
                    <h3>${video.title}</h3>
                    <p>${video.description}</p>
                    <video controls poster="${video.thumbnailUrl || ''}" src="${video.videoUrl}"></video>
                    
                    <div class="channel-info">
                        <span>Uploaded by: <strong>${video.uploaderName}</strong></span>
                        ${currentUser && currentUser.uid !== video.uploaderId ? 
                            `<button onclick="followUser('${video.uploaderId}')">Follow Channel</button>` : ''}
                    </div>

                    <!-- Comments Section -->
                    <div class="comments-section">
                        <h4>Comments</h4>
                        <div class="comment-input-group">
                            <input type="text" id="comment-input-${videoId}" placeholder="Add a comment...">
                            <button onclick="addComment('${videoId}')">Send</button>
                        </div>
                        <div id="comments-list-${videoId}">
                            ${(video.comments || []).map(c => `<p><strong>${c.user}:</strong> ${c.text}</p>`).join('')}
                        </div>
                    </div>
                </div>
            `;
        });
    });
}

// Follow User System
function followUser(uploaderId) {
    if (!currentUser) return alert('Please login to follow!');

    const uploaderRef = db.collection('users').doc(uploaderId);

    uploaderRef.get().then(doc => {
        let followers = doc.data().followers || [];
        if (!followers.includes(currentUser.uid)) {
            followers.push(currentUser.uid);
            uploaderRef.update({ followers: followers }).then(() => {
                alert('You are now following this channel!');
            });
        } else {
            alert('You are already following this channel.');
        }
    });
}

// Apply Monetization Function
function applyMonetization(userId) {
    db.collection('users').doc(userId).update({
        isMonetized: true
    }).then(() => {
        alert('Congratulations! Your Channel is now Monetized!');
    });
}

// Add Comment Function
function addComment(videoId) {
    if (!currentUser) return alert('Please login to comment!');

    const input = document.getElementById(`comment-input-${videoId}`);
    const commentText = input.value;

    if (!commentText) return;

    const videoRef = db.collection('videos').doc(videoId);

    videoRef.get().then(doc => {
        let comments = doc.data().comments || [];
        comments.push({
            user: currentUser.displayName,
            text: commentText
        });

        videoRef.update({ comments: comments }).then(() => {
            input.value = '';
        });
    });
}
