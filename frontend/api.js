// frontend/api.js

export const API_BASE_URL = 'http://127.0.0.1:8000';

// Hàm cũ để xử lý JSON (giữ nguyên, không cần sửa đổi)
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

// HÀM callApiFormData ĐÃ CẢI TIẾN - ĐÂY LÀ PHẦN BẠN CẦN THAY THẾ
async function callApiFormData(endpoint, method = 'POST', formData = null) {
    const config = {
        method: method,
        body: formData,
        // Khi gửi FormData, KHÔNG set Content-Type header. Trình duyệt sẽ tự động đặt
        // Content-Type: multipart/form-data với boundary phù hợp.
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        let data = null; // Khởi tạo data là null

        // Lấy Content-Type header để kiểm tra
        const contentType = response.headers.get('content-type');
        const isJson = contentType && contentType.includes('application/json');

        // Cố gắng phân tích JSON chỉ khi có phản hồi và Content-Type là JSON, và không phải 204 No Content
        if (response.status !== 204 && isJson) {
            try {
                data = await response.json();
            } catch (jsonError) {
                // Nếu JSON parsing thất bại, in ra lỗi và phản hồi thô để debug
                console.error(`API Call (FormData ${method} ${endpoint}) JSON parsing error:`, jsonError);
                console.error('Raw response text (attempted JSON):', await response.text()); 
                
                // Nếu phản hồi không phải 2xx (ví dụ: 4xx, 5xx) và parsing JSON thất bại,
                // thì ném lỗi thực sự. Ngược lại, đây chỉ là cảnh báo parsing.
                if (!response.ok) { 
                    const error = new Error(`Server responded with error status ${response.status} but invalid JSON.`);
                    error.status = response.status;
                    throw error;
                }
            }
        } else if (!response.ok && response.status !== 204) {
             // Nếu không phải 2xx và không phải 204 No Content, nhưng cũng không phải JSON (vd: lỗi HTML)
             const errorText = await response.text();
             console.error(`API Call (FormData ${method} ${endpoint}) Non-JSON error response:`, errorText);
             const error = new Error(`Server responded with non-JSON content or empty body for status ${response.status}. Detail: ${errorText.substring(0, 200)}...`); 
             error.status = response.status;
             throw error;
        }

        // Sau khi cố gắng phân tích JSON (hoặc bỏ qua nếu 204), kiểm tra trạng thái HTTP
        if (!response.ok) {
            // Đây là nhánh cho các mã trạng thái lỗi HTTP (4xx, 5xx)
            // Nếu data đã được parsed thành công, nó sẽ được sử dụng.
            // Nếu không, tạo lỗi dựa trên trạng thái HTTP.
            const error = new Error(data ? data.detail || 'Something went wrong' : `API Error: ${response.status} ${response.statusText}`);
            error.status = response.status;
            throw error;
        }
        return data; // Trả về dữ liệu đã phân tích (có thể là null nếu response 204)

    } catch (error) {
        // Đây là nhánh cho lỗi mạng hoặc lỗi xảy ra trước khi nhận được phản hồi từ server
        console.error(`API Call Error (FormData ${method} ${endpoint}) - Network or pre-response error:`, error);
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

export async function createCourse(formData) {
    return callApiFormData('/courses', 'POST', formData);
}

export async function deleteCourse(courseId, userId) {
    return callApi(`/courses/${courseId}?user_id=${userId}`, 'DELETE');
}

// --- Lecture APIs ---
export async function getLecturesForCourse(courseId) {
    return callApi(`/courses/${courseId}/lectures`);
}

export async function addLectureToCourse(courseId, formData) {
    // instructor_id đã được thêm vào formData ở frontend
    // main.py đã được sửa để nhận instructor_id từ Form data
    return callApiFormData(`/courses/${courseId}/lectures`, 'POST', formData);
}

export async function deleteLecture(lectureId, instructorId) {
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