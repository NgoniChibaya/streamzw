import React, { useContext, useState } from "react";
import { updateDoc, setDoc, doc, arrayUnion, arrayRemove, getDoc } from "firebase/firestore";
import { db } from "../Firebase/FirebaseConfig";
import { AuthContext } from "../Context/UserContext";
import toast, { Toaster } from "react-hot-toast";

function useUpdateWatchedMovies() {
  const { User } = useContext(AuthContext);
  const [Error, setError] = useState(false);

  const cleanObject = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    return Object.entries(obj).reduce((acc, [k, v]) => {
      if (v !== undefined) acc[k] = v;
      return acc;
    }, {});
  };

  function notify() {
    toast.success("  Movie removed from Watched List  ");
  }
  function alertError(message) {
    toast.error(message);
  }
  const addToWatchedMovies = async (movie, progress = 0, duration = 0) => {
    try {
      const docRef = doc(db, "WatchedMovies", User.uid);
      const docSnap = await getDoc(docRef);

      let movies = docSnap.exists() ? (docSnap.data().movies || []) : [];
      
      // Remove existing entry if found
      movies = movies.filter(m => m.id !== movie.id);
      
      // Add to beginning with metadata
      movies.unshift({
        ...movie,
        progress: progress,
        duration: duration,
        timestamp: Date.now(),
        completed: duration > 0 ? (progress / duration) > 0.9 : false
      });
      
      // Keep only last 50 and remove undefined fields
      movies = movies.slice(0, 50).map(cleanObject);

      if (docSnap.exists()) {
        await updateDoc(docRef, { movies });
      } else {
        await setDoc(docRef, { movies });
      }
    } catch (error) {
      console.error("Error adding to watched:", error);
    }
  };

  const updateWatchProgress = async (movieId, progress, duration) => {
    try {
      const docRef = doc(db, "WatchedMovies", User.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        let movies = docSnap.data().movies || [];
        const index = movies.findIndex(m => m.id === movieId);

        if (index !== -1) {
          movies[index] = cleanObject({
            ...movies[index],
            progress: progress,
            duration: duration,
            timestamp: Date.now(),
            completed: (progress / (duration || 1)) > 0.9
          });

          movies = movies.map(cleanObject);
          await updateDoc(docRef, { movies });
        } else {
          // If the movie entry doesn't exist yet, append a minimal entry
          const newEntry = cleanObject({
            id: movieId,
            progress: progress,
            duration: duration,
            timestamp: Date.now(),
            completed: (progress / (duration || 1)) > 0.9
          });
          movies.unshift(newEntry);
          movies = movies.map(cleanObject);
          await updateDoc(docRef, { movies });
        }
      } else {
        // Create the document with the single movie entry
        const newEntry = cleanObject({
          id: movieId,
          progress: progress,
          duration: duration,
          timestamp: Date.now(),
          completed: (progress / (duration || 1)) > 0.9
        });
        await setDoc(docRef, { movies: [newEntry] });
      }
    } catch (error) {
      console.error("Error updating progress:", error);
    }
  };

  const removeFromWatchedMovies = (movie) => {
    updateDoc(doc(db, "WatchedMovies", User.uid), {
      movies: arrayRemove(movie),
    })
      .then(() => {
        notify();
      })
      .catch((error) => {
        console.log(error.code);
        console.log(error.message);
        alertError(error.message);
        setError(true);
      });
  };

  const removePopupMessage = (
    <Toaster
      toastOptions={{
        style: {
          padding: "1.5rem",
          backgroundColor: Error ? "#fff4f4" : "#f4fff4",
          borderLeft: Error ? "6px solid red" : "6px solid lightgreen",
        },
      }}
    />
  );

  return { addToWatchedMovies, updateWatchProgress, removeFromWatchedMovies, removePopupMessage };
}

export default useUpdateWatchedMovies;
