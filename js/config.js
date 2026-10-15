/* =========================================================
   Imparo — Firebase configuration + Fixed Master User ID
   =========================================================
   لا يوجد Firebase Auth.
   جميع البيانات تُخزَّن تحت مسار ثابت: users/{USER_ID}/...
   ========================================================= */

window.FIREBASE_CONFIG = {
  apiKey:            "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain:        "imparo-app.firebaseapp.com",
  projectId:         "imparo-app",
  storageBucket:     "imparo-app.appspot.com",
  messagingSenderId: "123456789012",
  appId:             "1:123456789012:web:abcdef1234567890"
};

/* =========================================================
   ⚠️ مهم جدًا:
   - غيّر هذه القيمة إلى سلسلة طويلة وعشوائية.
   - استخدم نفس القيمة في firestore.rules.
   - لا تغيّرها بعد بدء الاستخدام (تغييرها = بيانات جديدة فارغة).
   - لا تشاركها مع أحد لا تثق به.
   ========================================================= */
window.USER_ID = "ahmed_imparo_admin_x7k9m2p4q8w3_v1";
