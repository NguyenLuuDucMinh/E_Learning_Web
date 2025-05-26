// frontend/script.js
import *  as api from './api.js'; // Import tất cả các hàm từ api.js (đã có)

document.addEventListener('DOMContentLoaded', () => {
    // --- UI Elements ---
    const loginRegisterBtn = document.getElementById('login-register-btn');
    const userProfile = document.getElementById('user-profile');
    const userNameDisplay = document.getElementById('user-name');
    const sidebarUserNameDisplay = document.getElementById('sidebar-user-name');
    const logoutBtn = document.getElementById('logout-btn');
    const sidebarLogoutBtn = document.getElementById('sidebar-logout-btn');
    const sidebar = document.getElementById('sidebar');

    const modalOverlay = document.getElementById('login-register-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalTabs = document.querySelectorAll('.modal-tab');
    const modalForms = document.querySelectorAll('.modal-form');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    const pageSections = document.querySelectorAll('.page-section');
    const navLinks = document.querySelectorAll('.main-nav .nav-link');
    const sidebarNavLinks = document.querySelectorAll('.sidebar-nav-link');

    const featuredCoursesGrid = document.getElementById('featured-courses-grid');
    const allCoursesGrid = document.getElementById('all-courses-grid');
    const myEnrolledCoursesGrid = document.getElementById('my-enrolled-courses-grid');
    const myCreatedCoursesGrid = document.getElementById('my-created-courses-grid');

    const courseDetailPage = document.getElementById('course-detail-page');
    const courseDetailImage = document.getElementById('course-detail-image');
    const courseDetailTitle = document.getElementById('course-detail-title');
    const courseDetailInstructor = document.getElementById('course-detail-instructor');
    const courseDetailPrice = document.getElementById('course-detail-price');
    const courseDetailDescription = document.getElementById('course-detail-description');
    const courseDetailCurriculum = document.getElementById('course-detail-curriculum');
    const instructorAvatar = document.getElementById('instructor-avatar');
    const instructorName = document.getElementById('instructor-name');
    const instructorBio = document.getElementById('instructor-bio');
    const enrollCourseBtn = document.getElementById('enroll-course-btn');
    const courseDetailTabs = document.querySelectorAll('.course-detail-tabs .tab-button');
    const courseDetailTabContents = document.querySelectorAll('#course-detail-page .tab-content');

    const learningPage = document.getElementById('learning-page');
    const learningCourseTitle = document.getElementById('learning-course-title');
    const videoPlayer = document.getElementById('video-player');
    const currentLectureTitle = document.getElementById('current-lecture-title');
    const learningLectureList = document.getElementById('learning-lecture-list');
    const prevLectureBtn = document.getElementById('prev-lecture-btn');
    const nextLectureBtn = document.getElementById('next-lecture-btn');

    const createCourseForm = document.getElementById('create-course-form');
    const createCoursePage = document.getElementById('create-course-page');
    const courseImageUrlInput = document.getElementById('course-image-url');
    const courseImageFileInput = document.getElementById('course-image-file');
    const courseImageFileNameSpan = document.getElementById('course-image-file-name');

    const editCourseLecturesPage = document.getElementById('edit-course-lectures-page');
    const editCourseTitle = document.getElementById('edit-course-title');
    const editLecturesList = document.getElementById('edit-lectures-list');
    const addLectureForm = document.getElementById('add-lecture-form');
    const currentEditingCourseIdInput = document.getElementById('current-editing-course-id');
    const lectureVideoUrlInput = document.getElementById('lecture-video-url');
    const lectureVideoFileInput = document.getElementById('lecture-video-file');
    const lectureVideoFileNameSpan = document.getElementById('lecture-video-file-name');


    const dashboardUserName = document.getElementById('dashboard-user-name');

    const mainHeader = document.getElementById('main-header');
    const contentWrapper = document.getElementById('content-wrapper');

    const upgradeAccountSection = document.getElementById('upgrade-account-section');
    const upgradeAccountBtn = document.getElementById('upgrade-account-btn');


    // --- Data (Backend-driven now) ---
    let currentUser = null; // Sẽ được lưu từ localStorage

    // --- Helper Functions ---

    function showPage(pageId) {
        pageSections.forEach(section => {
            section.classList.add('hidden');
        });
        document.getElementById(pageId).classList.remove('hidden');

        navLinks.forEach(link => {
            if (link.dataset.target === pageId) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
        sidebarNavLinks.forEach(link => {
            if (link.dataset.target === pageId) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        if (currentUser) {
            sidebar.classList.add('active');
            mainHeader.classList.add('shifted');
            contentWrapper.classList.add('shifted');
        } else {
            sidebar.classList.remove('active');
            mainHeader.classList.remove('shifted');
            contentWrapper.classList.remove('shifted');
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function renderCourseCards(targetElement, courseArray, showEditButton = false) {
        targetElement.innerHTML = '';
        if (!courseArray || courseArray.length === 0) {
            targetElement.innerHTML = '<p class="no-content">Chưa có khóa học nào tại đây.</p>';
            return;
        }
        courseArray.forEach(course => {
            const courseCard = document.createElement('div');
            courseCard.classList.add('course-card');
            const priceDisplay = course.is_free ? 'Miễn phí' : `${course.price.toLocaleString('vi-VN')} VNĐ`;

            let imageUrl = course.image_url;
            if (imageUrl && imageUrl.startsWith('/uploads/')) {
                imageUrl = api.API_BASE_URL + imageUrl;
            }
            if (!imageUrl) {
                imageUrl = 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&h=400&q=80';
            }


            courseCard.innerHTML = `
                <img src="${imageUrl}" alt="${course.title}">
                <div class="course-card-content">
                    <h3>${course.title}</h3>
                    <p class="instructor">Giảng viên: ${course.instructor_name || 'Đang cập nhật'}</p>
                    <p class="short-description">${course.short_description}</p>
                    <p class="price">${priceDisplay}</p>
                    ${showEditButton ?
                        `<div class="course-card-actions">
                            <button class="btn btn-primary edit-course-btn" data-course-id="${course.course_id}">Quản lý bài giảng</button>
                            <button class="btn btn-danger delete-card-course-btn" data-course-id="${course.course_id}"><i class="fas fa-trash-alt"></i> Xóa</button>
                        </div>` :
                        `<button class="btn btn-primary view-details-btn" data-course-id="${course.course_id}">Xem chi tiết</button>`
                    }
                </div>
            `;
            targetElement.appendChild(courseCard);
        });

        targetElement.querySelectorAll('.view-details-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const courseId = e.target.dataset.courseId;
                displayCourseDetail(courseId);
            });
        });
        if (showEditButton) {
            targetElement.querySelectorAll('.edit-course-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const courseId = e.target.dataset.courseId;
                    displayEditCourseLectures(courseId);
                });
            });
            targetElement.querySelectorAll('.delete-card-course-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const courseId = e.target.dataset.courseId;
                    deleteCourse(courseId);
                });
            });
        }
    }

    async function displayCourseDetail(courseId) {
        try {
            const course = await api.getCourseDetails(courseId);
            const lectures = await api.getLecturesForCourse(courseId);

            let courseDetailImgUrl = course.image_url;
            if (courseDetailImgUrl && courseDetailImgUrl.startsWith('/uploads/')) {
                courseDetailImgUrl = api.API_BASE_URL + courseDetailImgUrl;
            }
            if (!courseDetailImgUrl) {
                courseDetailImgUrl = 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&h=400&q=80';
            }
            courseDetailImage.src = courseDetailImgUrl;

            courseDetailTitle.textContent = course.title;
            courseDetailInstructor.textContent = course.instructor_name;
            courseDetailPrice.textContent = course.is_free ? 'Miễn phí' : `${course.price.toLocaleString('vi-VN')} VNĐ`;
            courseDetailDescription.textContent = course.full_description;

            courseDetailCurriculum.innerHTML = '';
            if (lectures.length === 0) {
                courseDetailCurriculum.innerHTML = '<li>Chưa có bài giảng nào được thêm vào khóa học này.</li>';
            } else {
                lectures.forEach((lecture, index) => {
                    let lectureType = 'Tài liệu';
                    if (lecture.video_url) {
                        if (lecture.video_url.startsWith('http')) {
                            lectureType = 'Video (URL)';
                        } else if (lecture.video_url.startsWith('/uploads/')) {
                            lectureType = 'Video (file)';
                        }
                    }

                    const li = document.createElement('li');
                    li.innerHTML = `Bài ${lecture.lecture_order}: ${lecture.title} <span>${lectureType}</span>`;
                    if (currentUser && userEnrolledCourses.some(c => c.course_id == course.course_id)) {
                        li.classList.add('clickable');
                        li.addEventListener('click', () => displayLearningPage(course.course_id, index));
                    }
                    courseDetailCurriculum.appendChild(li);
                });
            }

            instructorAvatar.src = 'https://images.unsplash.com/photo-1507003211169-e69adba4c2d9?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=100&h=100&q=80';
            instructorName.textContent = course.instructor_name;
            instructorBio.textContent = course.instructor_bio || 'Thông tin giảng viên đang được cập nhật.';

            const isEnrolled = currentUser && userEnrolledCourses.some(c => c.course_id == course.course_id);

            if (isEnrolled) {
                enrollCourseBtn.textContent = 'Tiếp tục học';
                enrollCourseBtn.classList.remove('btn-primary');
                enrollCourseBtn.classList.add('btn-secondary');
                enrollCourseBtn.onclick = () => displayLearningPage(course.course_id);
            } else {
                enrollCourseBtn.textContent = 'Đăng Ký Khóa Học';
                enrollCourseBtn.classList.remove('btn-secondary');
                enrollCourseBtn.classList.add('btn-primary');
                enrollCourseBtn.onclick = () => enrollCourse(course.course_id);
            }

            showPage('course-detail-page');
            courseDetailTabs.forEach(tab => tab.classList.remove('active'));
            courseDetailTabContents.forEach(content => content.classList.add('hidden'));
            document.querySelector('.course-detail-tabs .tab-button[data-tab="about"]').classList.add('active');
            document.getElementById('about-tab').classList.remove('hidden');

        } catch (error) {
            console.error('Error fetching course details:', error);
            alert(`Không thể tải chi tiết khóa học: ${error.message || 'Lỗi không xác định'}`);
            showPage('homepage');
        }
    }

    async function enrollCourse(courseId) {
        if (!currentUser) {
            alert('Vui lòng đăng nhập để đăng ký khóa học!');
            showModal('login');
            return;
        }
        
        try {
            await api.enrollCourse(currentUser.user_id, courseId);
            alert('Bạn đã đăng ký khóa học thành công!');
            await updateUIForLoggedInUser();
            displayLearningPage(courseId);
        } catch (error) {
            console.error('Error enrolling course:', error);
            if (error.status === 400 && error.message.includes("already enrolled")) {
                alert('Bạn đã đăng ký khóa học này rồi!');
                displayLearningPage(courseId);
            } else {
                alert(`Đăng ký khóa học thất bại: ${error.message || 'Lỗi không xác định'}`);
            }
        }
    }

    async function displayLearningPage(courseId, lectureIndex = 0) {
        if (!currentUser) {
             alert('Vui lòng đăng nhập để xem khóa học!');
             showModal('login');
             return;
        }

        try {
            const course = await api.getCourseDetails(courseId);
            const lectures = await api.getLecturesForCourse(courseId);

            if (!userEnrolledCourses.some(c => c.course_id == courseId)) {
                alert('Bạn chưa đăng ký khóa học này!');
                displayCourseDetail(courseId);
                return;
            }

            if (lectures.length === 0) {
                alert('Khóa học này chưa có bài giảng nào. Vui lòng thử lại sau!');
                displayCourseDetail(courseId);
                return;
            }

            learningCourseTitle.textContent = course.title;
            let currentLectureIdx = lectureIndex;

            function renderLectures() {
                learningLectureList.innerHTML = '';
                lectures.forEach((lecture, index) => {
                    const li = document.createElement('li');
                    li.textContent = `Bài ${lecture.lecture_order}: ${lecture.title}`;
                    if (index === currentLectureIdx) {
                        li.classList.add('active');
                        
                        let videoSrc = lecture.video_url;
                        if (videoSrc) {
                            if (videoSrc.startsWith('/uploads/')) {
                                videoSrc = api.API_BASE_URL + videoSrc;
                            } 
                            else if (videoSrc.includes('youtube.com/watch?v=')) {
                                videoSrc = videoSrc.replace('watch?v=', 'embed/');
                            }
                        } else {
                            videoSrc = 'https://www.youtube.com/embed/dQw4w9WgXcQ'; 
                        }
                        
                        videoPlayer.src = videoSrc;
                        currentLectureTitle.textContent = `Bài ${lecture.lecture_order}: ${lecture.title}`;
                    }
                    li.addEventListener('click', () => {
                        currentLectureIdx = index;
                        renderLectures();
                    });
                    learningLectureList.appendChild(li);
                });

                prevLectureBtn.disabled = currentLectureIdx === 0;
                nextLectureBtn.disabled = currentLectureIdx === lectures.length - 1;
            }

            prevLectureBtn.onclick = () => {
                if (currentLectureIdx > 0) {
                    currentLectureIdx--;
                    renderLectures();
                }
            };

            nextLectureBtn.onclick = () => {
                if (currentLectureIdx < lectures.length - 1) {
                    currentLectureIdx++;
                    renderLectures();
                }
            };

            renderLectures();
            showPage('learning-page');
        } catch (error) {
            console.error('Error loading learning page:', error);
            alert(`Không thể tải trang học tập: ${error.message || 'Lỗi không xác định'}`);
            showPage('homepage');
        }
    }

    function displayCreateCoursePage() {
        if (!currentUser || currentUser.role !== 'instructor') {
            alert('Bạn cần đăng nhập với tư cách giảng viên để tạo khóa học!');
            showModal('login');
            return;
        }
        createCourseForm.reset();
        document.getElementById('course-is-free').checked = false;
        document.getElementById('course-price').value = 0;
        document.getElementById('course-instructor').value = currentUser.username;
        courseImageFileNameSpan.textContent = '';
        courseImageUrlInput.value = '';
        showPage('create-course-page');
    }

    createCourseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser || currentUser.role !== 'instructor') {
            alert('Bạn không có quyền tạo khóa học.');
            return;
        }

        const isFree = document.getElementById('course-is-free').checked;
        const priceValue = parseFloat(document.getElementById('course-price').value || 0);

        const formData = new FormData();
        formData.append('title', document.getElementById('course-title').value);
        formData.append('short_description', document.getElementById('course-short-desc').value);
        formData.append('full_description', document.getElementById('course-full-desc').value);
        formData.append('instructor_id', currentUser.user_id);
        formData.append('price', isFree ? 0 : priceValue);
        formData.append('instructor_bio', 'Thông tin giảng viên đang được cập nhật.');

        if (courseImageFileInput.files.length > 0) {
            formData.append('course_image_file', courseImageFileInput.files[0]);
        } else if (courseImageUrlInput.value) {
            formData.append('course_image_url', courseImageUrlInput.value);
        }

        try {
            const createdCourse = await api.createCourse(formData);
            alert('Khóa học của bạn đã được tạo thành công!');
            await updateUIForLoggedInUser();
            displayEditCourseLectures(createdCourse.course_id);
        } catch (error) {
            console.error('Error creating course:', error);
            alert(`Tạo khóa học thất bại: ${error.message || 'Lỗi không xác định'}`);
        }
    });

    courseImageFileInput.addEventListener('change', () => {
        if (courseImageFileInput.files.length > 0) {
            courseImageFileNameSpan.textContent = `File đã chọn: ${courseImageFileInput.files[0].name}`;
            courseImageUrlInput.value = '';
        } else {
            courseImageFileNameSpan.textContent = '';
        }
    });

    courseImageUrlInput.addEventListener('input', () => {
        if (courseImageUrlInput.value) {
            courseImageFileInput.value = '';
            courseImageFileNameSpan.textContent = '';
        }
    });


    async function renderMyEnrolledCourses() {
        if (!currentUser) {
            myEnrolledCoursesGrid.innerHTML = '<p class="no-content">Bạn cần đăng nhập để xem các khóa học đã đăng ký.</p>';
            return;
        }
        try {
            const enrolledCourses = await api.getUserEnrolledCourses(currentUser.user_id);
            renderCourseCards(myEnrolledCoursesGrid, enrolledCourses);
        } catch (error) {
            console.error('Error fetching enrolled courses:', error);
            myEnrolledCoursesGrid.innerHTML = `<p class="no-content">Không thể tải khóa học đã đăng ký: ${error.message || 'Lỗi không xác định'}</p>`;
        }
    }

    async function renderMyCreatedCourses() {
        if (!currentUser || currentUser.role !== 'instructor') {
            myCreatedCoursesGrid.innerHTML = '<p class="no-content">Bạn cần đăng nhập với tư cách giảng viên để xem các khóa học đã tạo.</p>';
            return;
        }
        try {
            const createdCourses = await api.getUserCreatedCourses(currentUser.user_id);
            renderCourseCards(myCreatedCoursesGrid, createdCourses, true);
        } catch (error) {
            console.error('Error fetching created courses:', error);
            myCreatedCoursesGrid.innerHTML = `<p class="no-content">Không thể tải khóa học đã tạo: ${error.message || 'Lỗi không xác định'}</p>`;
        }
    }

    // HÀM MỚI: Chỉ cập nhật danh sách bài giảng và form
    async function refreshLectureList(courseId) {
        try {
            const lectures = await api.getLecturesForCourse(courseId);
            editLecturesList.innerHTML = '';
            if (lectures.length === 0) {
                editLecturesList.innerHTML = '<p class="no-content">Chưa có bài giảng nào trong khóa học này.</p>';
            } else {
                lectures.forEach((lecture, index) => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <span>Bài ${lecture.lecture_order}: ${lecture.title}</span>
                        <div class="lecture-actions">
                            <button class="btn btn-secondary btn-small delete-lecture-btn" data-lecture-id="${lecture.lecture_id}">Xóa</button>
                        </div>
                    `;
                    editLecturesList.appendChild(li);
                });

                editLecturesList.querySelectorAll('.delete-lecture-btn').forEach(button => {
                    button.addEventListener('click', async (e) => {
                        const lectureId = e.target.dataset.lectureId;
                        if (confirm('Bạn có chắc chắn muốn xóa bài giảng này?')) {
                            try {
                                await api.deleteLecture(lectureId, currentUser.user_id);
                                alert('Bài giảng đã được xóa.');
                                refreshLectureList(courseId); // Chỉ làm mới danh sách
                            } catch (error) {
                                console.error('Error deleting lecture:', error);
                                alert(`Xóa bài giảng thất bại: ${error.message || 'Lỗi không xác định'}`);
                            }
                        }
                    });
                });
            }
            // Reset form sau khi thêm thành công
            addLectureForm.reset();
            lectureVideoFileNameSpan.textContent = '';
            lectureVideoUrlInput.value = '';

        } catch (error) {
            console.error('Error refreshing lecture list:', error);
            alert(`Không thể tải lại danh sách bài giảng: ${error.message || 'Lỗi không xác định'}`);
            // Có thể chuyển về trang khóa học đã tạo nếu lỗi quá nghiêm trọng
            showPage('my-created-courses-page');
        }
    }


    async function displayEditCourseLectures(courseId) {
        if (!currentUser || currentUser.role !== 'instructor') {
            alert('Bạn không có quyền chỉnh sửa khóa học này.');
            showPage('my-created-courses-page');
            return;
        }
        try {
            const course = await api.getCourseDetails(courseId);

            if (course.instructor_id !== currentUser.user_id) {
                alert('Bạn không có quyền chỉnh sửa khóa học này.');
                showPage('my-created-courses-page');
                return;
            }

            editCourseTitle.textContent = course.title;
            currentEditingCourseIdInput.value = course.course_id;
            
            showPage('edit-course-lectures-page'); // Hiển thị trang một lần
            await refreshLectureList(course.course_id); // Sau đó gọi hàm refresh để tải danh sách và reset form
            
        } catch (error) {
            console.error('Error loading edit course lectures page:', error);
            alert(`Không thể tải trang quản lý bài giảng: ${error.message || 'Lỗi không xác định'}`);
            showPage('my-created-courses-page');
        }
    }

    addLectureForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser || currentUser.role !== 'instructor') {
            alert('Bạn không có quyền thêm bài giảng.');
            return;
        }

        const courseId = currentEditingCourseIdInput.value;
        
        const formData = new FormData();
        formData.append('title', document.getElementById('lecture-title').value);
        formData.append('description', document.getElementById('lecture-description').value);
        formData.append('instructor_id', currentUser.user_id);

        if (lectureVideoFileInput.files.length > 0) {
            formData.append('video_file', lectureVideoFileInput.files[0]);
        } else if (lectureVideoUrlInput.value) {
            formData.append('video_url', lectureVideoUrlInput.value);
        }

        try {
            await api.addLectureToCourse(courseId, formData);
            alert('Bài giảng đã được thêm thành công!');
            // CHỈ CẦN GỌI HÀM NÀY ĐỂ CẬP NHẬT GIAO DIỆN MÀ KHÔNG CHUYỂN TRANG
            await refreshLectureList(courseId); 
        } catch (error) {
            console.error('Error adding lecture:', error);
            alert(`Thêm bài giảng thất bại: ${error.message || 'Lỗi không xác định'}`);
        }
    });

    lectureVideoFileInput.addEventListener('change', () => {
        if (lectureVideoFileInput.files.length > 0) {
            lectureVideoFileNameSpan.textContent = `File đã chọn: ${lectureVideoFileInput.files[0].name}`;
            lectureVideoUrlInput.value = '';
        } else {
            lectureVideoFileNameSpan.textContent = '';
        }
    });

    lectureVideoUrlInput.addEventListener('input', () => {
        if (lectureVideoUrlInput.value) {
            lectureVideoFileInput.value = '';
            lectureVideoFileNameSpan.textContent = '';
        }
    });

    async function deleteCourse(courseId) {
        if (!currentUser || currentUser.role !== 'instructor') {
            alert('Bạn không có quyền xóa khóa học này.');
            return;
        }

        const confirmDelete = confirm('Bạn có chắc chắn muốn xóa khóa học này? Hành động này không thể hoàn tác!');
        if (!confirmDelete) {
            return;
        }

        try {
            await api.deleteCourse(courseId, currentUser.user_id);
            alert('Khóa học đã được xóa thành công!');
            await renderMyCreatedCourses();
        } catch (error) {
            console.error('Error deleting course:', error);
            alert(`Xóa khóa học thất bại: ${error.message || 'Lỗi không xác định'}`);
        }
    }


    // --- Auth Functions (Giữ nguyên) ---
    async function login(user) {
        console.log("Logged in user:", user);
        currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        await updateUIForLoggedInUser();
        showPage('dashboard');
        modalOverlay.classList.remove('active');
    }

    async function logout() {
        console.log("Logging out user:", currentUser ? currentUser.username : "N/A");
        currentUser = null;
        localStorage.removeItem('currentUser');
        userEnrolledCourses = [];
        await updateUIForLoggedInUser();
        showPage('homepage');
    }

    function showModal(formType) {
        console.log("Showing modal for:", formType);
        modalOverlay.classList.remove('hidden');
        modalOverlay.classList.add('active');
        modalForms.forEach(form => form.classList.add('hidden'));
        modalTabs.forEach(tab => tab.classList.remove('active'));

        if (formType === 'login') {
            document.getElementById('login-form').classList.remove('hidden');
            document.querySelector('.modal-tab[data-modal-tab="login"]').classList.add('active');
        } else {
            document.getElementById('register-form').classList.remove('hidden');
            document.querySelector('.modal-tab[data-modal-tab="register"]').classList.add('active');
        }
    }

    let userEnrolledCourses = [];

       async function updateUIForLoggedInUser() {
        console.log("updateUIForLoggedInUser called. Current User:", currentUser);
        if (currentUser) {
            loginRegisterBtn.classList.add('hidden');
            userProfile.classList.remove('hidden');
            userNameDisplay.textContent = `Chào, ${currentUser.username}!`;
            sidebarUserNameDisplay.textContent = currentUser.username;
            sidebar.classList.add('active');

            mainHeader.classList.add('shifted');
            contentWrapper.classList.add('shifted');

            if (dashboardUserName) {
                dashboardUserName.textContent = currentUser.username;
            }
            
            try {
                userEnrolledCourses = await api.getUserEnrolledCourses(currentUser.user_id);
            }
            catch (error) {
                console.error("Failed to fetch user enrolled courses:", error);
                userEnrolledCourses = [];
            }

            const createCourseLink = document.querySelector('[data-target="create-course-page"]');
            const myCreatedCoursesLink = document.querySelector('[data-target="my-created-courses-page"]');

            if (currentUser.role === 'instructor') {
                createCourseLink.style.display = 'flex';
                myCreatedCoursesLink.style.display = 'flex';
                if (upgradeAccountSection) {
                    upgradeAccountSection.classList.add('hidden');
                }
            } else {
                createCourseLink.style.display = 'none';
                myCreatedCoursesLink.style.display = 'none';
                if (upgradeAccountSection) {
                    upgradeAccountSection.classList.remove('hidden');
                }
            }
            console.log("UI updated for logged in user.");
        } else {
            loginRegisterBtn.classList.remove('hidden');
            userProfile.classList.add('hidden');
            sidebar.classList.remove('active');

            mainHeader.classList.remove('shifted');
            contentWrapper.classList.remove('shifted');

            document.querySelector('[data-target="create-course-page"]').style.display = 'none';
            document.querySelector('[data-target="my-created-courses-page"]').style.display = 'none';
            if (upgradeAccountSection) {
                upgradeAccountSection.classList.add('hidden');
            }
            console.log("UI updated for logged out user.");
        }
    }

    // --- Event Listeners (Giữ nguyên) ---
    if (upgradeAccountBtn) {
        upgradeAccountBtn.addEventListener('click', async () => {
            if (!currentUser) {
                alert('Bạn cần đăng nhập để nâng cấp tài khoản.');
                showModal('login');
                return;
            }
            if (currentUser.role === 'instructor') {
                alert('Tài khoản của bạn đã là giảng viên rồi.');
                return;
            }

            if (confirm('Bạn có chắc chắn muốn nâng cấp tài khoản lên giảng viên? Bạn sẽ có thể tạo và quản lý các khóa học của riêng mình.')) {
                try {
                    const updatedUser = await api.upgradeUserToInstructor(currentUser.user_id);
                    alert('Chúc mừng! Tài khoản của bạn đã được nâng cấp lên giảng viên thành công.');
                    
                    currentUser = updatedUser;
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    
                    await updateUIForLoggedInUser();
                    showPage('dashboard');
                } catch (error) {
                    console.error('Lỗi khi nâng cấp tài khoản:', error);
                    alert(`Nâng cấp tài khoản thất bại: ${error.message || 'Lỗi không xác định'}`);
                }
            }
        });
    }

    loginRegisterBtn.addEventListener('click', () => showModal('login'));

    userProfile.addEventListener('click', (e) => {
        e.stopPropagation();
        userProfile.classList.toggle('active');
    });
    document.addEventListener('click', (e) => {
        if (userProfile && !userProfile.contains(e.target) && userProfile.classList.contains('active')) {
            userProfile.classList.remove('active');
        }
    });

    logoutBtn.addEventListener('click', logout);
    sidebarLogoutBtn.addEventListener('click', logout);

    modalCloseBtn.addEventListener('click', () => modalOverlay.classList.remove('active'));

    modalTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            modalTabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            modalForms.forEach(form => form.classList.add('hidden'));
            document.getElementById(`${e.target.dataset.modalTab}-form`).classList.remove('hidden');
        });
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const user = await api.loginUser(email, password);
            alert('Đăng nhập thành công!');
            await login(user);
        } catch (error) {
            console.error('Login failed:', error);
            alert(`Đăng nhập thất bại: ${error.message || 'Email hoặc mật khẩu không đúng.'}`);
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;

        if (password !== confirmPassword) {
            alert('Mật khẩu và xác nhận mật khẩu không khớp!');
            return;
        }

        try {
            const user = await api.registerUser(name, email, password);
            alert('Đăng ký thành công! Vui lòng đăng nhập.');
            loginForm.reset();
            registerForm.reset();
            showModal('login');
        } catch (error) {
            console.error('Registration failed:', error);
            alert(`Đăng ký thất bại: ${error.message || 'Email hoặc tên người dùng đã tồn tại.'}`);
        }
    });

    document.querySelectorAll('.nav-link, .sidebar-nav-link').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const targetPage = e.target.dataset.target;

            if (targetPage === 'create-course-page') {
                displayCreateCoursePage();
            } else if (targetPage === 'my-created-courses-page') {
                if (!currentUser || currentUser.role !== 'instructor') {
                    alert('Bạn cần đăng nhập với tư cách giảng viên để xem các khóa học đã tạo.');
                    showModal('login');
                    return;
                }
                await renderMyCreatedCourses();
                showPage(targetPage);
            } else if (targetPage === 'my-courses') {
                if (!currentUser) {
                    alert('Bạn cần đăng nhập để xem các khóa học đã đăng ký.');
                    showModal('login');
                    return;
                }
                await renderMyEnrolledCourses();
                showPage(targetPage);
            } else if (targetPage === 'browse-courses') {
                try {
                    const allCourses = await api.getAllCourses();
                    renderCourseCards(allCoursesGrid, allCourses);
                    showPage(targetPage);
                } catch (error) {
                    console.error('Error fetching all courses:', error);
                    allCoursesGrid.innerHTML = `<p class="no-content">Không thể tải tất cả khóa học: ${error.message || 'Lỗi không xác định'}</p>`;
                    showPage(targetPage);
                }
            } else if (targetPage === 'dashboard') {
                if (!currentUser) {
                    alert('Bạn cần đăng nhập để xem Dashboard.');
                    showModal('login');
                    return;
                }
                showPage(targetPage);
            }
            else {
                showPage(targetPage);
            }
        });
    });

    courseDetailTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            courseDetailTabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            courseDetailTabContents.forEach(content => content.classList.add('hidden'));
            document.getElementById(`${e.target.dataset.tab}-tab`).classList.remove('hidden');
        });
    });

    const courseIsFreeCheckbox = document.getElementById('course-is-free');
    const coursePriceInput = document.getElementById('course-price');
    if (courseIsFreeCheckbox && coursePriceInput) {
        courseIsFreeCheckbox.addEventListener('change', () => {
            if (courseIsFreeCheckbox.checked) {
                coursePriceInput.value = 0;
                coursePriceInput.disabled = true;
            } else {
                coursePriceInput.disabled = false;
            }
        });
    }

    // --- Initial Load ---
    async function init() {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            await updateUIForLoggedInUser();
        } else {
            document.querySelector('[data-target="create-course-page"]').style.display = 'none';
            document.querySelector('[data-target="my-created-courses-page"]').style.display = 'none';
        }
        await renderHomepageCourses();
        showPage('homepage');
    }

    async function renderHomepageCourses() {
        try {
            const featured = await api.getFeaturedCourses();
            renderCourseCards(featuredCoursesGrid, featured);
        } catch (error) {
            console.error('Error fetching featured courses:', error);
            featuredCoursesGrid.innerHTML = `<p class="no-content">Không thể tải các khóa học nổi bật: ${error.message || 'Lỗi không xác định'}</p>`;
        }
    }

    init();
});