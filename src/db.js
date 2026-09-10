import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, addDoc,
  query, orderBy, where, documentId, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db } from "./firebase-config.js";

const DEFAULT_ACTIVITIES = [
  { name: "ランニング・筋トレ", icon: "🏃", color: "#e07a5f" },
  { name: "瞑想", icon: "🧘", color: "#81b29a" },
  { name: "楽器の練習", icon: "🎸", color: "#f2cc8f" },
  { name: "速読トレーニング", icon: "📖", color: "#3d405b" },
  { name: "英語学習", icon: "🗣️", color: "#5aa9e6" },
  { name: "チェスの練習", icon: "♟️", color: "#6d597a" },
];

function activitiesRef(uid) {
  return collection(db, "users", uid, "activities");
}

export async function seedDefaultActivitiesIfEmpty(uid) {
  const snapshot = await getDocs(activitiesRef(uid));
  if (!snapshot.empty) return;

  await Promise.all(
    DEFAULT_ACTIVITIES.map((activity, index) =>
      addDoc(activitiesRef(uid), { ...activity, order: index, active: true, createdAt: serverTimestamp() })
    )
  );
}

export async function getActivities(uid) {
  const snapshot = await getDocs(query(activitiesRef(uid), orderBy("order")));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addActivity(uid, { name, icon, color, order }) {
  const docRef = await addDoc(activitiesRef(uid), {
    name, icon, color, order, active: true, createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateActivity(uid, activityId, patch) {
  await updateDoc(doc(db, "users", uid, "activities", activityId), patch);
}

export async function reorderActivities(uid, orderedIds) {
  await Promise.all(orderedIds.map((id, index) => updateActivity(uid, id, { order: index })));
}

function logDocRef(uid, dateStr) {
  return doc(db, "users", uid, "logs", dateStr);
}

export async function getLog(uid, dateStr) {
  const snap = await getDoc(logDocRef(uid, dateStr));
  return snap.exists() ? snap.data() : { entries: {} };
}

export async function setEntry(uid, dateStr, activityId, { done, memo }) {
  const ref = logDocRef(uid, dateStr);
  await setDoc(ref, { entries: { [activityId]: { done, memo: memo || "" } }, updatedAt: serverTimestamp() }, { merge: true });
}

export async function getLogsInRange(uid, startDateStr, endDateStr) {
  const logsRef = collection(db, "users", uid, "logs");
  const snapshot = await getDocs(
    query(logsRef, where(documentId(), ">=", startDateStr), where(documentId(), "<=", endDateStr))
  );
  const map = new Map();
  snapshot.forEach((d) => map.set(d.id, d.data()));
  return map;
}
