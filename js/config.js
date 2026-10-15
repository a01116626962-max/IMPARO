/* =========================================================
   Imparo — Firebase configuration + Fixed Master User ID
   =========================================================
   Project: imparo-53eea
   Mode: No Auth (Fixed Master User ID)
   ========================================================= */

window.FIREBASE_CONFIG = {

  apiKey:            "AIzaSyA0Ca2fqu7Pw80sKhXVuqaz5h3UIaau_LQ",
  authDomain:        "imparo-53eea.firebaseapp.com",
  projectId:         "imparo-53eea",
  storageBucket:     "imparo-53eea.firebasestorage.app",
  messagingSenderId: "558351996816",
  appId:             "1:558351996816:web:6698c08e636482e2908515"

};

/* =========================================================
   ⚠️⚠️⚠️  معرّف المستخدم الثابت  ⚠️⚠️⚠️
   -----------------------------------------------------
   نفس القيمة يجب أن تكون في firestore.rules
   ========================================================= */

window.USER_ID = "ahmed_imparo_53eea_x7k9m2p4q8w3_admin";
