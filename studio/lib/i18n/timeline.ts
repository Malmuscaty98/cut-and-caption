import type { Bundle } from "../i18n";

// Timeline, transcript and the caption-line editor.
export const timeline: Bundle = {
  ar: {
    // Timeline — toolbar
    "timeline.viewOutput": "بعد القص",
    "timeline.viewOutputTitle": "المعاينة بعد تطبيق القصات",
    "timeline.viewSource": "الأصل",
    "timeline.viewSourceTitle": "الفيديو الأصلي كامل والقصات باللون الأحمر",
    "timeline.acceptCuts": "اقبل القصات المقترحة ({n})",
    "timeline.acceptCutsTitle": "تفعيل قصات الحشو والإعادات المقترحة",
    "timeline.acceptZooms": "اقبل الزوم المقترح ({n})",
    "timeline.acceptZoomsTitle": "تفعيل الزوم المقترح",
    "timeline.zoomSlider": "تكبير",
    // Timeline — track headers and tracks
    "timeline.trackAudio": "الصوت",
    "timeline.trackCuts": "القصات",
    "timeline.trackCaptions": "الكابشن",
    "timeline.trackZooms": "الزوم",
    "timeline.cutTrackTitle": "اسحب في مكان فاضي لإضافة قصة يدوية",
    "timeline.cutItemHint": "كلك مرة للتحديد، ومرة ثانية للتفعيل/التعطيل",
    "timeline.zoomTrackTitle": "اسحب في مكان فاضي لإضافة زوم — كلك على زوم محدد يطفيه/يشغله",
    // Timeline — undo labels
    "timeline.timelineEdit": "تعديل على التايملاين",
    "timeline.toggleCut": "تعطيل/تفعيل قصة",
    "timeline.toggleZoom": "تعطيل/تفعيل زوم",
    "timeline.manualCut": "قصة يدوية",
    "timeline.manualZoom": "زوم يدوي",
    "timeline.acceptProposals": "قبول المقترحات",
    "timeline.acceptZoomProposals": "قبول الزوم المقترح",

    // Transcript
    "timeline.transcript": "النص",
    "timeline.lines": "{lines} سطر · {words} كلمة",
    "timeline.selectedWords": "{n} كلمة",
    "timeline.restoreWords": "رجّع الكلمات",
    "timeline.cut": "قص",
    "timeline.emphasize": "إبراز",
    "timeline.newLineHere": "سطر جديد هنا",
    "timeline.kashida": "كشيدة",
    "timeline.kashidaTitle": "تمديد الكلمة بالكشيدة (ـ) مثل «يستعمـل»",
    "timeline.lineNumTitle": "{time} — اضغط لتحديد السطر، دبل كلك لتعديل النص",
    "timeline.editLineTitle": "عدّل نص السطر (أضف / غيّر / احذف كلمات)",
    "timeline.customStyle": "ستايل خاص",
    "timeline.wordInfo": "{time} · ثقة {conf}",
    "timeline.proposedCut": "قصة مقترحة",
    "timeline.doubleClickToEdit": "دبل كلك للتعديل",
    // Transcript — undo labels
    "timeline.uncut": "إلغاء القص",
    "timeline.cutWords": "قص الكلمات",
    "timeline.newLine": "سطر جديد",
    "timeline.editWord": "تعديل كلمة",

    // Line editor
    "timeline.lineEditorTitle": "Enter للحفظ · Esc للإلغاء — الكلمات اللي ما تغيّرت تحتفظ بتوقيتها، والجديدة تاخذ وقت من اللي جنبها",
    "timeline.editLineText": "تعديل نص السطر",
  },
  en: {
    // Timeline — toolbar
    "timeline.viewOutput": "Edited",
    "timeline.viewOutputTitle": "Preview with the cuts applied",
    "timeline.viewSource": "Source",
    "timeline.viewSourceTitle": "The whole original video, with cuts shown in red",
    "timeline.acceptCuts": "Accept proposed cuts ({n})",
    "timeline.acceptCutsTitle": "Apply the proposed filler and retake cuts",
    "timeline.acceptZooms": "Accept proposed zooms ({n})",
    "timeline.acceptZoomsTitle": "Apply the proposed zooms",
    "timeline.zoomSlider": "Zoom",
    // Timeline — track headers and tracks
    "timeline.trackAudio": "Audio",
    "timeline.trackCuts": "Cuts",
    "timeline.trackCaptions": "Captions",
    "timeline.trackZooms": "Zooms",
    "timeline.cutTrackTitle": "Drag across an empty spot to add a manual cut",
    "timeline.cutItemHint": "Click to select, click again to turn it on/off",
    "timeline.zoomTrackTitle": "Drag across an empty spot to add a zoom — clicking a selected zoom turns it on/off",
    // Timeline — undo labels
    "timeline.timelineEdit": "Timeline edit",
    "timeline.toggleCut": "Toggle cut",
    "timeline.toggleZoom": "Toggle zoom",
    "timeline.manualCut": "Manual cut",
    "timeline.manualZoom": "Manual zoom",
    "timeline.acceptProposals": "Accept proposed cuts",
    "timeline.acceptZoomProposals": "Accept proposed zooms",

    // Transcript
    "timeline.transcript": "Transcript",
    "timeline.lines": "{lines} lines · {words} words",
    "timeline.selectedWords": "{n} selected",
    "timeline.restoreWords": "Restore words",
    "timeline.cut": "Cut",
    "timeline.emphasize": "Emphasize",
    "timeline.newLineHere": "New line here",
    "timeline.kashida": "Kashida",
    "timeline.kashidaTitle": "Stretch the word with a kashida (ـ), as in “يستعمـل”",
    "timeline.lineNumTitle": "{time} — click to select the line, double-click to edit its text",
    "timeline.editLineTitle": "Edit the line text (add / change / delete words)",
    "timeline.customStyle": "Custom style",
    // Starts with a word, not the time: this tooltip sits on Arabic (RTL) words, and a leading
    // number would get reordered to the end of the line there.
    "timeline.wordInfo": "Confidence {conf} · {time}",
    "timeline.proposedCut": "Proposed cut",
    "timeline.doubleClickToEdit": "Double-click to edit",
    // Transcript — undo labels
    "timeline.uncut": "Restore cut words",
    "timeline.cutWords": "Cut words",
    "timeline.newLine": "New line",
    "timeline.editWord": "Edit word",

    // Line editor
    "timeline.lineEditorTitle": "Enter to save · Esc to cancel — unchanged words keep their timing; new words borrow time from their neighbors",
    "timeline.editLineText": "Edit line text",
  },
};
