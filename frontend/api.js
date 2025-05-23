// frontend/api.js

const API_BASE_URL = 'http://127.0.0.1:8000'; // Địa chỉ của backend FastAPI

async function callApi(endpoint, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json',
    };

    const config = {
        method: method,
        headers: headers,
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        const data = await response.json();

        if (!response.ok) {
            // Nếu có lỗi từ server (ví dụ: status 4xx, 5xx)
            const error = new Error(data.detail || 'Something went wrong');
            error.status = response.status;
            throw error;
        }
        return data;
    } catch (error) {
        console.error(`API Call Error (${method} ${endpoint}):`, error);
        throw error;
    }
}

// --- Auth APIs ---
export async function registerUser(username, email, password) {
    return callApi('/register', 'POST', { username, email, password });
}

export async function loginUser(email, password) {
    return callApi('/login', 'POST', { email, password });
}

// --- Course APIs ---
export async function getAllCourses() {
    return callApi('/courses');
}

export async function getFeaturedCourses() {
    return callApi('/courses/featured');
}

export async function getCourseDetails(courseId) {
    return callApi(`/courses/${courseId}`);
}

export async function createCourse(courseData) {
    // courseData phải chứa instructor_id
    return callApi('/courses', 'POST', courseData);
}

export async function deleteCourse(courseId, userId) {
    // Để đơn giản, userId được truyền qua body hoặc query param.
    // Trong một hệ thống thực tế, sẽ dùng token xác thực và lấy userId từ token.
    return callApi(`/courses/${courseId}?user_id=${userId}`, 'DELETE');
}

// --- Lecture APIs ---
export async function getLecturesForCourse(courseId) {
    return callApi(`/courses/${courseId}/lectures`);
}

export async function addLectureToCourse(courseId, lectureData, instructorId) {
    // lectureData: { title, video_url, description }
    // instructorId: ID của giảng viên đang đăng nhập
    return callApi(`/courses/${courseId}/lectures?instructor_id=${instructorId}`, 'POST', lectureData);
}

export async function deleteLecture(lectureId, instructorId) {
    // instructorId: ID của giảng viên đang đăng nhập
    return callApi(`/lectures/${lectureId}?instructor_id=${instructorId}`, 'DELETE');
}

// --- Enrollment APIs ---
export async function enrollCourse(userId, courseId) {
    return callApi('/enroll', 'POST', { user_id: userId, course_id: courseId });
}

export async function getUserEnrolledCourses(userId) {
    return callApi(`/users/${userId}/enrolled_courses`);
}

export async function getUserCreatedCourses(userId) {
    return callApi(`/users/${userId}/created_courses`);
}

export async function upgradeUserToInstructor(userId) {
    return callApi(`/users/${userId}/upgrade-to-instructor`, 'PUT');
}