from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import pyodbc
from typing import List, Optional
import os # <-- Đảm bảo đã import os
import uuid
import aiofiles
from pathlib import Path # <-- Đảm bảo đã import Path

# Cấu hình kết nối Database (giữ nguyên)
DB_CONFIG = {
    "DRIVER": "{ODBC Driver 17 for SQL Server}",
    "SERVER": "DESKTOP-S730D0D\SQLEXPRESS01",
    "DATABASE": "ELearningDB",
    "UID": "sa",
    "PWD": "123"
}

DB_CONN_STR = (
    f"DRIVER={DB_CONFIG['DRIVER']};"
    f"SERVER={DB_CONFIG['SERVER']};"
    f"DATABASE={DB_CONFIG['DATABASE']};"
    f"UID={DB_CONFIG['UID']};"
    f"PWD={DB_CONFIG['PWD']}"
)

# --- Pydantic Models (giữ nguyên) ---
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
        orm_mode = True

class CourseBase(BaseModel):
    title: str
    image_url: Optional[str] = None
    short_description: Optional[str] = None
    full_description: Optional[str] = None
    price: float
    instructor_bio: Optional[str] = None

class CourseOut(CourseBase):
    course_id: int
    instructor_id: int
    instructor_name: Optional[str] = None
    is_free: bool = False

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
        if hasattr(row, 'InstructorName'):
            course.instructor_name = row.InstructorName
        return course

    class Config:
        orm_mode = True

class LectureBase(BaseModel):
    title: str
    video_url: Optional[str] = None
    description: Optional[str] = None

class LectureOut(LectureBase):
    lecture_id: int
    course_id: int
    lecture_order: int

    class Config:
        orm_mode = True

class EnrollmentCreate(BaseModel):
    user_id: int
    course_id: int

class EnrollmentOut(BaseModel):
    enrollment_id: int
    user_id: int
    course_id: int
    enrollment_date: str
    
    class Config:
        orm_mode = True

# --- FastAPI App Setup (giữ nguyên) ---
app = FastAPI(title="E-Learning Vibe Backend")

origins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Cấu hình thư mục tĩnh cho uploads ---
UPLOAD_FOLDER = "uploads"
IMAGES_FOLDER = Path(UPLOAD_FOLDER) / "images"
VIDEOS_FOLDER = Path(UPLOAD_FOLDER) / "videos"

IMAGES_FOLDER.mkdir(parents=True, exist_ok=True)
VIDEOS_FOLDER.mkdir(parents=True, exist_ok=True)

app.mount(f"/{UPLOAD_FOLDER}", StaticFiles(directory=UPLOAD_FOLDER), name=UPLOAD_FOLDER)

# Dependency để lấy kết nối database (giữ nguyên)
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

# --- Utility Functions (giữ nguyên) ---
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

# --- Auth Endpoints (giữ nguyên) ---
@app.post("/register", response_model=UserOut)
async def register(user: UserCreate, db: pyodbc.Connection = Depends(get_db_connection)):
    cursor = db.cursor()
    try:
        cursor.execute("INSERT INTO Users (Username, Email, Password) VALUES (?, ?, ?)", 
                       user.username, user.email, user.password)
        db.commit()
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
    if user_row.Password != user_login.password:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return UserOut(
        user_id=user_row.UserID,
        username=user_row.Username,
        email=user_row.Email,
        role=user_row.Role
    )

# --- User Management Endpoints (giữ nguyên) ---
@app.put("/users/{user_id}/upgrade-to-instructor", response_model=UserOut)
async def upgrade_user_to_instructor(user_id: int, db: pyodbc.Connection = Depends(get_db_connection)):
    user_to_upgrade = get_user_by_id(db, user_id)
    if not user_to_upgrade:
        raise HTTPException(status_code=404, detail="Người dùng không tìm thấy.")
    if user_to_upgrade.role == 'instructor':
        raise HTTPException(status_code=400, detail="Người dùng đã là giảng viên rồi.")
    cursor = db.cursor()
    try:
        cursor.execute("UPDATE Users SET Role = 'instructor' WHERE UserID = ?", user_id)
        db.commit()
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
async def create_course(
    title: str = Form(...),
    short_description: str = Form(...),
    full_description: Optional[str] = Form(None),
    course_image_url: Optional[str] = Form(None),
    course_image_file: Optional[UploadFile] = File(None),
    instructor_id: int = Form(...),
    price: float = Form(0.0),
    instructor_bio: Optional[str] = Form(None),
    db: pyodbc.Connection = Depends(get_db_connection)
):
    instructor_user = get_user_by_id(db, instructor_id)
    if not instructor_user or instructor_user.role != 'instructor':
        raise HTTPException(status_code=403, detail="Only instructors can create courses or invalid instructor ID.")

    image_path_to_save = None
    if course_image_file and course_image_file.filename:
        extension = course_image_file.filename.split(".")[-1]
        unique_filename = f"{uuid.uuid4()}.{extension}"
        file_location = IMAGES_FOLDER / unique_filename
        
        try:
            async with aiofiles.open(file_location, "wb") as f:
                while content := await course_image_file.read(1024):
                    await f.write(content)
            image_path_to_save = f"/{UPLOAD_FOLDER}/images/{unique_filename}" 
            print(f"DEBUG: Image file saved successfully to: {file_location}")
            print(f"DEBUG: Image URL to save in DB: {image_path_to_save}")
        except Exception as e:
            print(f"DEBUG: Error saving image file: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to upload image file: {e}")
    elif course_image_url:
        image_path_to_save = course_image_url
        print(f"DEBUG: Using provided image URL: {image_path_to_save}")
    else:
        image_path_to_save = 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&h=400&q=80'
        print(f"DEBUG: Using default image URL: {image_path_to_save}")

    cursor = db.cursor()
    try:
        cursor.execute("""
            INSERT INTO Courses (Title, ImageURL, ShortDescription, FullDescription, Price, InstructorID, InstructorBio)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, 
        title, 
        image_path_to_save,
        short_description, 
        full_description, 
        price, 
        instructor_id,
        instructor_bio
        )
        db.commit()
        
        cursor.execute("SELECT @@IDENTITY AS CourseID")
        new_course_id = cursor.fetchone()[0]

        return get_course_by_id(db, new_course_id)
    except Exception as e:
        print(f"DEBUG: Database error creating course: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create course: {e}")

@app.delete("/courses/{course_id}")
async def delete_course(course_id: int, user_id: int, db: pyodbc.Connection = Depends(get_db_connection)):
    course_to_delete = get_course_by_id(db, course_id)
    if not course_to_delete:
        raise HTTPException(status_code=404, detail="Course not found")
    
    if course_to_delete.instructor_id != user_id:
        raise HTTPException(status_code=403, detail="You are not authorized to delete this course.")

    # --- BỔ SUNG LOGIC XÓA FILE ẢNH KHÓA HỌC ---
    if course_to_delete.image_url and course_to_delete.image_url.startswith(f"/{UPLOAD_FOLDER}/images/"):
        # Xây dựng đường dẫn vật lý đầy đủ đến file
        # strip('/') để loại bỏ '/' đầu tiên, sau đó nối với thư mục gốc của project
        relative_path = course_to_delete.image_url.lstrip('/') 
        file_to_delete_path = Path(__file__).parent / relative_path # Path(__file__).parent là thư mục chứa main.py
        
        print(f"DEBUG: Attempting to delete course image file: {file_to_delete_path}")
        try:
            # Kiểm tra xem file có tồn tại và là một file hợp lệ không trước khi xóa
            if file_to_delete_path.exists() and file_to_delete_path.is_file():
                file_to_delete_path.unlink() # Xóa file
                print(f"DEBUG: Successfully deleted file: {file_to_delete_path}")
            else:
                print(f"DEBUG: File not found or is not a regular file: {file_to_delete_path}")
        except OSError as e: # Bắt các lỗi liên quan đến hệ thống file (ví dụ: quyền truy cập)
            print(f"ERROR: Failed to delete image file {file_to_delete_path}: {e}")
            # Có thể ném HTTPException nếu muốn báo lỗi cho người dùng
            # Hoặc chỉ log lỗi và tiếp tục xóa bản ghi DB nếu việc xóa file không bắt buộc
            raise HTTPException(status_code=500, detail=f"Failed to delete associated image file: {e}. Please check server permissions.")
    else:
        print(f"DEBUG: No local image file to delete for course {course_id} (URL: {course_to_delete.image_url})")
    # --- KẾT THÚC LOGIC XÓA FILE ---

    cursor = db.cursor()
    try:
        cursor.execute("DELETE FROM Courses WHERE CourseID = ?", course_id)
        db.commit()
        return {"message": "Course deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete course record from DB: {e}")

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
async def add_lecture_to_course(
    course_id: int, 
    instructor_id: int = Form(...), 
    title: str = Form(...),
    video_url: Optional[str] = Form(None),
    video_file: Optional[UploadFile] = File(None),
    description: Optional[str] = Form(None),
    db: pyodbc.Connection = Depends(get_db_connection)
):
    course = get_course_by_id(db, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    if course.instructor_id != instructor_id:
        raise HTTPException(status_code=403, detail="You are not authorized to add lectures to this course.")

    video_path_to_save = None
    if video_file and video_file.filename:
        extension = video_file.filename.split(".")[-1]
        unique_filename = f"{uuid.uuid4()}.{extension}"
        file_location = VIDEOS_FOLDER / unique_filename
        
        if not video_file.content_type.startswith('video/'):
            raise HTTPException(status_code=400, detail="Uploaded file is not a video.")

        try:
            async with aiofiles.open(file_location, "wb") as f:
                while content := await video_file.read(1024):
                    await f.write(content)
            video_path_to_save = f"/{UPLOAD_FOLDER}/videos/{unique_filename}"
            print(f"DEBUG: Video file saved successfully to: {file_location}")
            print(f"DEBUG: Video URL to save in DB: {video_path_to_save}")
        except Exception as e:
            print(f"DEBUG: Error saving video file: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to upload video file: {e}")
    elif video_url:
        video_path_to_save = video_url
        print(f"DEBUG: Using provided video URL: {video_path_to_save}")
    else:
        video_path_to_save = 'https://www.youtube.com/embed/dQw4w9WgXcQ'
        print(f"DEBUG: Using default video URL: {video_path_to_save}")

    cursor = db.cursor()
    try:
        cursor.execute("SELECT ISNULL(MAX(LectureOrder), 0) + 1 FROM Lectures WHERE CourseID = ?", course_id)
        next_order = cursor.fetchone()[0]

        cursor.execute("""
            INSERT INTO Lectures (CourseID, Title, VideoURL, Description, LectureOrder)
            VALUES (?, ?, ?, ?, ?)
        """, 
        course_id, 
        title, 
        video_path_to_save,
        description, 
        next_order
        )
        db.commit()
        
        cursor.execute("SELECT @@IDENTITY AS LectureID")
        new_lecture_id = cursor.fetchone()[0]

        return LectureOut(
            lecture_id=new_lecture_id,
            course_id=course_id,
            title=title,
            video_url=video_path_to_save,
            description=description,
            lecture_order=next_order
        )
    except Exception as e:
        print(f"DEBUG: Database error adding lecture: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add lecture: {e}")

@app.delete("/lectures/{lecture_id}")
async def delete_lecture(lecture_id: int, instructor_id: int, db: pyodbc.Connection = Depends(get_db_connection)):
    lecture_to_delete = get_lecture_by_id(db, lecture_id)
    if not lecture_to_delete:
        raise HTTPException(status_code=404, detail="Lecture not found")
    
    course_of_lecture = get_course_by_id(db, lecture_to_delete.course_id)
    if not course_of_lecture or course_of_lecture.instructor_id != instructor_id:
        raise HTTPException(status_code=403, detail="You are not authorized to delete this lecture.")

    # --- BỔ SUNG LOGIC XÓA FILE VIDEO BÀI GIẢNG ---
    if lecture_to_delete.video_url and lecture_to_delete.video_url.startswith(f"/{UPLOAD_FOLDER}/videos/"):
        # Xây dựng đường dẫn vật lý đầy đủ đến file
        relative_path = lecture_to_delete.video_url.lstrip('/')
        file_to_delete_path = Path(__file__).parent / relative_path
        
        print(f"DEBUG: Attempting to delete lecture video file: {file_to_delete_path}")
        try:
            if file_to_delete_path.exists() and file_to_delete_path.is_file():
                file_to_delete_path.unlink()
                print(f"DEBUG: Successfully deleted file: {file_to_delete_path}")
            else:
                print(f"DEBUG: File not found or is not a regular file: {file_to_delete_path}")
        except OSError as e:
            print(f"ERROR: Failed to delete video file {file_to_delete_path}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to delete associated video file: {e}. Please check server permissions.")
    else:
        print(f"DEBUG: No local video file to delete for lecture {lecture_id} (URL: {lecture_to_delete.video_url})")
    # --- KẾT THÚC LOGIC XÓA FILE ---

    cursor = db.cursor()
    try:
        cursor.execute("DELETE FROM Lectures WHERE LectureID = ?", lecture_id)
        db.commit()
        return {"message": "Lecture deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete lecture record from DB: {e}")

# --- Enrollment Endpoints (giữ nguyên) ---
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

@app.get("/")
async def root():
    return {"message": "Welcome to E-Learning Vibe API"}