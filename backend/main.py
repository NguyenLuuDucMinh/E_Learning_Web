from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pyodbc
from typing import List, Optional
import os

# Cấu hình kết nối Database
# THAY THẾ CÁC THÔNG TIN NÀY BẰNG CẤU HÌNH SQL SERVER CỦA BẠN
DB_CONFIG = {
    "DRIVER": "{ODBC Driver 17 for SQL Server}", # Hoặc phiên bản driver của bạn
    "SERVER": "DESKTOP-S730D0D\SQLEXPRESS01", # Ví dụ: 'localhost' hoặc 'your_server_name\SQLEXPRESS'
    "DATABASE": "ELearningDB",
    "UID": "sa", # Tên người dùng SQL Server
    "PWD": "123"  # Mật khẩu SQL Server
}

# Xây dựng connection string
DB_CONN_STR = (
    f"DRIVER={DB_CONFIG['DRIVER']};"
    f"SERVER={DB_CONFIG['SERVER']};"
    f"DATABASE={DB_CONFIG['DATABASE']};"
    f"UID={DB_CONFIG['UID']};"
    f"PWD={DB_CONFIG['PWD']}"
)

# --- Pydantic Models ---

# User Models
class UserBase(BaseModel):
    username: str
    email: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserOut(UserBase):
    user_id: int
    role: str

    class Config:
        orm_mode = True # Cho phép mapping từ SQLAlchemy/ORM object

# Course Models
class CourseBase(BaseModel):
    title: str
    image_url: Optional[str] = None
    short_description: Optional[str] = None
    full_description: Optional[str] = None
    price: float
    instructor_bio: Optional[str] = None

class CourseCreate(CourseBase):
    instructor_id: int # Instructor ID will be passed from frontend (logged-in user's ID)

class CourseOut(CourseBase):
    course_id: int
    instructor_id: int
    instructor_name: Optional[str] = None # Will be populated by backend
    is_free: bool = False # Derived from price

    @staticmethod
    def from_row(row):
        course = CourseOut(
            course_id=row.CourseID,
            title=row.Title,
            image_url=row.ImageURL,
            short_description=row.ShortDescription,
            full_description=row.FullDescription,
            price=float(row.Price),
            instructor_id=row.InstructorID,
            instructor_bio=row.InstructorBio,
            is_free=float(row.Price) == 0.0
        )
        # Assuming instructor_name is directly available in the row from a JOIN
        if hasattr(row, 'InstructorName'):
            course.instructor_name = row.InstructorName
        return course

    class Config:
        orm_mode = True

# Lecture Models
class LectureBase(BaseModel):
    title: str
    video_url: Optional[str] = None
    description: Optional[str] = None

class LectureCreate(LectureBase):
    course_id: int # Course ID will be passed from path parameter
    lecture_order: int

class LectureOut(LectureBase):
    lecture_id: int
    course_id: int
    lecture_order: int

    class Config:
        orm_mode = True

# Enrollment Model
class EnrollmentCreate(BaseModel):
    user_id: int
    course_id: int

class EnrollmentOut(BaseModel):
    enrollment_id: int
    user_id: int
    course_id: int
    enrollment_date: str # Converted to string for JSON
    
    class Config:
        orm_mode = True

# --- FastAPI App Setup ---
app = FastAPI(title="E-Learning Vibe Backend")

# Cấu hình CORS
origins = [
    "http://127.0.0.1:5500", # Địa chỉ của frontend của bạn (Live Server)
    "http://localhost:5500",
    # Thêm các địa chỉ khác nếu cần
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency để lấy kết nối database
def get_db_connection():
    cnxn = None
    try:
        cnxn = pyodbc.connect(DB_CONN_STR, autocommit=True)
        yield cnxn
    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        if sqlstate == '28000':
            raise HTTPException(status_code=500, detail="Database connection failed: Invalid credentials.")
        else:
            raise HTTPException(status_code=500, detail=f"Database connection error: {ex}")
    finally:
        if cnxn:
            cnxn.close()

# --- Utility Functions ---

def get_user_by_id(db: pyodbc.Connection, user_id: int):
    cursor = db.cursor()
    cursor.execute("SELECT UserID, Username, Email, Role FROM Users WHERE UserID = ?", user_id)
    user_row = cursor.fetchone()
    if user_row:
        return UserOut(
            user_id=user_row.UserID,
            username=user_row.Username,
            email=user_row.Email,
            role=user_row.Role
        )
    return None

def get_course_by_id(db: pyodbc.Connection, course_id: int):
    cursor = db.cursor()
    cursor.execute("""
        SELECT c.*, u.Username AS InstructorName
        FROM Courses c
        JOIN Users u ON c.InstructorID = u.UserID
        WHERE c.CourseID = ?
    """, course_id)
    course_row = cursor.fetchone()
    if course_row:
        return CourseOut.from_row(course_row)
    return None

def get_lecture_by_id(db: pyodbc.Connection, lecture_id: int):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM Lectures WHERE LectureID = ?", lecture_id)
    lecture_row = cursor.fetchone()
    if lecture_row:
        return LectureOut(
            lecture_id=lecture_row.LectureID,
            course_id=lecture_row.CourseID,
            title=lecture_row.Title,
            video_url=lecture_row.VideoURL,
            description=lecture_row.Description,
            lecture_order=lecture_row.LectureOrder
        )
    return None

# --- API Endpoints ---

# --- Auth Endpoints ---
@app.post("/register", response_model=UserOut)
async def register(user: UserCreate, db: pyodbc.Connection = Depends(get_db_connection)):
    cursor = db.cursor()
    try:
        cursor.execute("INSERT INTO Users (Username, Email, Password) VALUES (?, ?, ?)", 
                       user.username, user.email, user.password)
        db.commit() # autocommit=True already set, but explicit commit is good practice
        
        # Lấy UserID vừa tạo (IDENTITY_INSERT)
        cursor.execute("SELECT @@IDENTITY AS UserID")
        new_user_id = cursor.fetchone()[0]

        return UserOut(user_id=new_user_id, username=user.username, email=user.email, role="student")
    except pyodbc.IntegrityError:
        raise HTTPException(status_code=400, detail="Email or username already registered.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {e}")

@app.post("/login", response_model=UserOut)
async def login(user_login: UserLogin, db: pyodbc.Connection = Depends(get_db_connection)):
    cursor = db.cursor()
    cursor.execute("SELECT UserID, Username, Email, Password, Role FROM Users WHERE Email = ?", user_login.email)
    user_row = cursor.fetchone()

    if not user_row:
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    # Theo yêu cầu, không cần hash, so sánh trực tiếp
    if user_row.Password != user_login.password:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    return UserOut(
        user_id=user_row.UserID,
        username=user_row.Username,
        email=user_row.Email,
        role=user_row.Role
    )

# --- User Management Endpoints (Add this section) ---
@app.put("/users/{user_id}/upgrade-to-instructor", response_model=UserOut)
async def upgrade_user_to_instructor(user_id: int, db: pyodbc.Connection = Depends(get_db_connection)):
    """
    Nâng cấp tài khoản người dùng từ 'student' lên 'instructor'.
    """
    user_to_upgrade = get_user_by_id(db, user_id)
    if not user_to_upgrade:
        raise HTTPException(status_code=404, detail="Người dùng không tìm thấy.")

    if user_to_upgrade.role == 'instructor':
        raise HTTPException(status_code=400, detail="Người dùng đã là giảng viên rồi.")

    cursor = db.cursor()
    try:
        cursor.execute("UPDATE Users SET Role = 'instructor' WHERE UserID = ?", user_id)
        db.commit()
        
        # Lấy lại thông tin người dùng đã cập nhật để trả về
        updated_user = get_user_by_id(db, user_id)
        return updated_user
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi nâng cấp vai trò người dùng: {e}")

# --- Course Endpoints ---
@app.get("/courses", response_model=List[CourseOut])
async def get_all_courses(db: pyodbc.Connection = Depends(get_db_connection)):
    cursor = db.cursor()
    cursor.execute("""
        SELECT c.*, u.Username AS InstructorName
        FROM Courses c
        JOIN Users u ON c.InstructorID = u.UserID
        ORDER BY c.CourseID DESC
    """)
    courses_rows = cursor.fetchall()
    return [CourseOut.from_row(row) for row in courses_rows]

@app.get("/courses/featured", response_model=List[CourseOut])
async def get_featured_courses(db: pyodbc.Connection = Depends(get_db_connection)):
    cursor = db.cursor()
    # Ví dụ: Các khóa học miễn phí hoặc 3 khóa học gần nhất
    cursor.execute("""
        SELECT c.*, u.Username AS InstructorName
        FROM Courses c
        JOIN Users u ON c.InstructorID = u.UserID
        WHERE c.Price = 0 OR c.CourseID IN (SELECT TOP 3 CourseID FROM Courses ORDER BY CourseID DESC)
        ORDER BY c.CourseID DESC
    """)
    courses_rows = cursor.fetchall()
    return [CourseOut.from_row(row) for row in courses_rows]

@app.get("/courses/{course_id}", response_model=CourseOut)
async def get_course_details(course_id: int, db: pyodbc.Connection = Depends(get_db_connection)):
    course = get_course_by_id(db, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course

@app.post("/courses", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
async def create_course(course: CourseCreate, db: pyodbc.Connection = Depends(get_db_connection)):
    # Kiểm tra xem instructor_id có tồn tại và có vai trò 'instructor' không
    instructor_user = get_user_by_id(db, course.instructor_id)
    if not instructor_user or instructor_user.role != 'instructor':
        raise HTTPException(status_code=403, detail="Only instructors can create courses or invalid instructor ID.")

    cursor = db.cursor()
    try:
        cursor.execute("""
            INSERT INTO Courses (Title, ImageURL, ShortDescription, FullDescription, Price, InstructorID, InstructorBio)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, 
        course.title, 
        course.image_url, 
        course.short_description, 
        course.full_description, 
        course.price, 
        course.instructor_id,
        course.instructor_bio # Giả định instructor_bio được truyền cùng lúc tạo khóa học
        )
        db.commit()
        
        cursor.execute("SELECT @@IDENTITY AS CourseID")
        new_course_id = cursor.fetchone()[0]

        # Lấy lại thông tin khóa học đầy đủ để trả về
        return get_course_by_id(db, new_course_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create course: {e}")

@app.delete("/courses/{course_id}")
async def delete_course(course_id: int, user_id: int, db: pyodbc.Connection = Depends(get_db_connection)):
    # user_id ở đây phải là ID của người dùng đang đăng nhập để kiểm tra quyền
    course_to_delete = get_course_by_id(db, course_id)
    if not course_to_delete:
        raise HTTPException(status_code=404, detail="Course not found")
    
    if course_to_delete.instructor_id != user_id:
        raise HTTPException(status_code=403, detail="You are not authorized to delete this course.")

    cursor = db.cursor()
    try:
        # Xóa các bài giảng trước (do ON DELETE CASCADE trên Lectures)
        # hoặc bạn có thể chỉ cần xóa course nếu đã cấu hình ON DELETE CASCADE trên khóa ngoại Courses.Lectures.CourseID
        # cursor.execute("DELETE FROM Lectures WHERE CourseID = ?", course_id) 
        # cursor.execute("DELETE FROM Enrollments WHERE CourseID = ?", course_id) 

        cursor.execute("DELETE FROM Courses WHERE CourseID = ?", course_id)
        db.commit()
        return {"message": "Course deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete course: {e}")

# --- Lecture Endpoints ---
@app.get("/courses/{course_id}/lectures", response_model=List[LectureOut])
async def get_lectures_for_course(course_id: int, db: pyodbc.Connection = Depends(get_db_connection)):
    course = get_course_by_id(db, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    cursor = db.cursor()
    cursor.execute("SELECT * FROM Lectures WHERE CourseID = ? ORDER BY LectureOrder ASC", course_id)
    lectures_rows = cursor.fetchall()
    return [
        LectureOut(
            lecture_id=row.LectureID,
            course_id=row.CourseID,
            title=row.Title,
            video_url=row.VideoURL,
            description=row.Description,
            lecture_order=row.LectureOrder
        ) for row in lectures_rows
    ]

@app.post("/courses/{course_id}/lectures", response_model=LectureOut, status_code=status.HTTP_201_CREATED)
async def add_lecture_to_course(course_id: int, lecture: LectureBase, instructor_id: int, db: pyodbc.Connection = Depends(get_db_connection)):
    # instructor_id ở đây phải là ID của người dùng đang đăng nhập để kiểm tra quyền
    course = get_course_by_id(db, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    if course.instructor_id != instructor_id:
        raise HTTPException(status_code=403, detail="You are not authorized to add lectures to this course.")

    cursor = db.cursor()
    try:
        # Tự động xác định LectureOrder tiếp theo
        cursor.execute("SELECT ISNULL(MAX(LectureOrder), 0) + 1 FROM Lectures WHERE CourseID = ?", course_id)
        next_order = cursor.fetchone()[0]

        cursor.execute("""
            INSERT INTO Lectures (CourseID, Title, VideoURL, Description, LectureOrder)
            VALUES (?, ?, ?, ?, ?)
        """, 
        course_id, 
        lecture.title, 
        lecture.video_url, 
        lecture.description, 
        next_order
        )
        db.commit()
        
        cursor.execute("SELECT @@IDENTITY AS LectureID")
        new_lecture_id = cursor.fetchone()[0]

        return LectureOut(
            lecture_id=new_lecture_id,
            course_id=course_id,
            title=lecture.title,
            video_url=lecture.video_url,
            description=lecture.description,
            lecture_order=next_order
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add lecture: {e}")

@app.delete("/lectures/{lecture_id}")
async def delete_lecture(lecture_id: int, instructor_id: int, db: pyodbc.Connection = Depends(get_db_connection)):
    lecture_to_delete = get_lecture_by_id(db, lecture_id)
    if not lecture_to_delete:
        raise HTTPException(status_code=404, detail="Lecture not found")
    
    course_of_lecture = get_course_by_id(db, lecture_to_delete.course_id)
    if not course_of_lecture or course_of_lecture.instructor_id != instructor_id:
        raise HTTPException(status_code=403, detail="You are not authorized to delete this lecture.")

    cursor = db.cursor()
    try:
        cursor.execute("DELETE FROM Lectures WHERE LectureID = ?", lecture_id)
        db.commit()
        return {"message": "Lecture deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete lecture: {e}")

# --- Enrollment Endpoints ---
@app.post("/enroll", response_model=EnrollmentOut, status_code=status.HTTP_201_CREATED)
async def enroll_course(enrollment: EnrollmentCreate, db: pyodbc.Connection = Depends(get_db_connection)):
    user_exists = get_user_by_id(db, enrollment.user_id)
    if not user_exists:
        raise HTTPException(status_code=404, detail="User not found")
    
    course_exists = get_course_by_id(db, enrollment.course_id)
    if not course_exists:
        raise HTTPException(status_code=404, detail="Course not found")

    cursor = db.cursor()
    try:
        cursor.execute("INSERT INTO Enrollments (UserID, CourseID) VALUES (?, ?)", 
                       enrollment.user_id, enrollment.course_id)
        db.commit()
        
        cursor.execute("SELECT @@IDENTITY AS EnrollmentID")
        new_enrollment_id = cursor.fetchone()[0]

        return EnrollmentOut(
            enrollment_id=new_enrollment_id,
            user_id=enrollment.user_id,
            course_id=enrollment.course_id,
            enrollment_date=db.execute("SELECT EnrollmentDate FROM Enrollments WHERE EnrollmentID = ?", new_enrollment_id).fetchone()[0].isoformat()
        )
    except pyodbc.IntegrityError:
        raise HTTPException(status_code=400, detail="User already enrolled in this course.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Enrollment failed: {e}")

@app.get("/users/{user_id}/enrolled_courses", response_model=List[CourseOut])
async def get_user_enrolled_courses(user_id: int, db: pyodbc.Connection = Depends(get_db_connection)):
    user_exists = get_user_by_id(db, user_id)
    if not user_exists:
        raise HTTPException(status_code=404, detail="User not found")

    cursor = db.cursor()
    cursor.execute("""
        SELECT c.*, u.Username AS InstructorName
        FROM Courses c
        JOIN Enrollments e ON c.CourseID = e.CourseID
        JOIN Users u ON c.InstructorID = u.UserID
        WHERE e.UserID = ?
        ORDER BY e.EnrollmentDate DESC
    """, user_id)
    courses_rows = cursor.fetchall()
    return [CourseOut.from_row(row) for row in courses_rows]

@app.get("/users/{user_id}/created_courses", response_model=List[CourseOut])
async def get_user_created_courses(user_id: int, db: pyodbc.Connection = Depends(get_db_connection)):
    user_exists = get_user_by_id(db, user_id)
    if not user_exists or user_exists.role != 'instructor':
        raise HTTPException(status_code=403, detail="User is not an instructor or not found.")

    cursor = db.cursor()
    cursor.execute("""
        SELECT c.*, u.Username AS InstructorName
        FROM Courses c
        JOIN Users u ON c.InstructorID = u.UserID
        WHERE c.InstructorID = ?
        ORDER BY c.CourseID DESC
    """, user_id)
    courses_rows = cursor.fetchall()
    return [CourseOut.from_row(row) for row in courses_rows]


# Endpoint cơ bản để kiểm tra server
@app.get("/")
async def root():
    return {"message": "Welcome to E-Learning Vibe API"}