import type { Bundle } from "../i18n";

// The editor shell: home page, loading, keyboard-shortcut undo labels, player bar, export panel, toasts.
export const shell: Bundle = {
  ar: {
    // Home page
    "shell.homeTitle": "Cut & Caption · قص وكابشن",
    "shell.homeHint": "مشروع جديد: قل لـ Claude «قص السكتات وأضف كابشن لـ …» مع مسار الفيديو. المشاريع محفوظة في {path}",
    "shell.homeWords": "{n} كلمة",
    "shell.homeEmpty": "ما في مشاريع بعد.",

    // Editor
    "shell.loading": "…جاري التحميل",
    "shell.openFailed": "ما قدرت أفتح المشروع: {error}",
    "shell.newVersionReloading": "تحديث جديد للمحرر — يعيد التحميل…",
    "shell.externalChange": "تحدّث المشروع من برّا (Claude) — ⌘Z يرجّع",

    // Undo labels (shown in the Undo tooltip)
    "shell.undo": "تراجع",
    "shell.redo": "إعادة",
    "shell.splitLine": "قسم السطر",
    "shell.mergeLines": "دمج سطرين",
    "shell.emphasize": "إبراز",
    "shell.cutWords": "قص الكلمات",
    "shell.toggleCut": "تعطيل/تفعيل قصة",
    "shell.deleteZoom": "حذف زوم",
    "shell.moveCaption": "تحريك الكابشن",
    "shell.manualCutNote": "قص يدوي: «{words}»",

    // Player
    "shell.dragCaptionTitle": "اسحب لتحريك الكابشن (لو محدد سطر، يتحرك هو بس)",
    "shell.reelsGuides": "حدود Reels",

    // Export
    "shell.jobBusy": "فيه عملية شغّالة — انتظرها تخلص",
    "shell.exportTitle": "تصدير الفيديو",
    "shell.exportSize": "المقاس",
    "shell.aspectPost": "4:5 — منشور",
    "shell.aspectSquare": "1:1 — مربع",
    "shell.aspectYoutube": "16:9 — يوتيوب",
    "shell.exportProposed": "فيه {n} قصة مقترحة ما قررت فيها — بتنصدّر بدونها.",
    "shell.exportMp4": "صدّر MP4",
    "shell.exportDraft": "نسخة سريعة",
    "shell.exportDraftTitle": "من الـ proxy — أسرع، للمراجعة",
    "shell.exportFilesIn": "الملفات تنحفظ في {path} مع نسخة من project.json.",
    "shell.exportQuality": "الجودة: 1080×1920، BT.709، x264 slow (CRF 17)، والصوت من ملفك بدون إعادة ضغط لو ما فيه قصات.",
    "shell.exportIgTip": "انستقرام: الإعدادات ← استخدام البيانات وجودة الوسائط ← فعّل {setting}. تيك توك: فعّل الرفع بجودة عالية (HD).",
    "shell.exportIgSetting": "«Upload at highest quality»",
    "shell.jobRunning": "شغّال",
    "shell.jobDone": "خلص ✓",
    "shell.jobFailed": "فشل ✗",
    "shell.openFile": "افتح",
  },
  en: {
    // Home page
    "shell.homeTitle": "Cut & Caption",
    "shell.homeHint": "New project: tell Claude “Cut the silences and add captions to …” along with the video's path. Projects are saved in {path}",
    "shell.homeWords": "{n} words",
    "shell.homeEmpty": "No projects yet.",

    // Editor
    "shell.loading": "Loading…",
    "shell.openFailed": "Couldn't open the project: {error}",
    "shell.newVersionReloading": "New editor version — reloading…",
    "shell.externalChange": "Project updated from outside (Claude) — ⌘Z to undo",

    // Undo labels (shown in the Undo tooltip)
    "shell.undo": "Undo",
    "shell.redo": "Redo",
    "shell.splitLine": "Split line",
    "shell.mergeLines": "Merge lines",
    "shell.emphasize": "Emphasize",
    "shell.cutWords": "Cut words",
    "shell.toggleCut": "Toggle cut",
    "shell.deleteZoom": "Delete zoom",
    "shell.moveCaption": "Move caption",
    "shell.manualCutNote": "Manual cut: “{words}”",

    // Player
    "shell.dragCaptionTitle": "Drag to move the caption (if a line is selected, only that line moves)",
    "shell.reelsGuides": "Reels guides",

    // Export
    "shell.jobBusy": "A job is already running — wait for it to finish",
    "shell.exportTitle": "Export video",
    "shell.exportSize": "Aspect ratio",
    "shell.aspectPost": "4:5 — Post",
    "shell.aspectSquare": "1:1 — Square",
    "shell.aspectYoutube": "16:9 — YouTube",
    "shell.exportProposed": "Undecided proposed cuts: {n} — they won't be applied in the export.",
    "shell.exportMp4": "Export MP4",
    "shell.exportDraft": "Quick draft",
    "shell.exportDraftTitle": "From the proxy — faster, for review",
    "shell.exportFilesIn": "Files are saved to {path} along with a copy of project.json.",
    "shell.exportQuality": "Quality: 1080×1920, BT.709, x264 slow (CRF 17); the audio comes from your file without re-encoding when there are no cuts.",
    "shell.exportIgTip": "Instagram: Settings → Data usage and media quality → turn on {setting}. TikTok: turn on high-quality (HD) uploads.",
    "shell.exportIgSetting": "Upload at highest quality",
    "shell.jobRunning": "Running",
    "shell.jobDone": "Done ✓",
    "shell.jobFailed": "Failed ✗",
    "shell.openFile": "Open",
  },
};
