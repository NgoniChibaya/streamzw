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
      const entry = cleanObject({
        completed: duration > 0 ? (progress / duration) > 0.9 : false,
        duration: duration || 0,
        progress: progress || 0,
        timestamp: Date.now(),
      });

      // Store as map keyed by movie id
      await updateDoc(docRef, {
        [`movies.${movie.id}`]: entry,
      }).catch(async (err) => {
        // If doc doesn't exist, create it
        if (err.code === 'not-found' || err.message?.includes('No document to update')) {
          await setDoc(docRef, { movies: { [movie.id]: entry } });
        } else {
          throw err;
        }
      });
    } catch (error) {
      console.error("Error adding to watched:", error);
    }
  };

  const updateWatchProgress = async (movieId, progress, duration) => {
    try {
      // Don't save if duration is 0 or invalid
      if (!duration || duration <= 0) {
        console.log('Skipping progress save: duration is invalid', { movieId, progress, duration });
        return;
      }

      const docRef = doc(db, "WatchedMovies", User.uid);
      const docSnap = await getDoc(docRef);
      
      const entry = cleanObject({
        completed: (progress / duration) > 0.9,
        duration: duration,
        progress: progress,
        timestamp: Date.now(),
      });

      // If the document exists, update the specific movie entry in the map
      if (docSnap.exists()) {
        await updateDoc(docRef, {
          [`movies.${movieId}`]: entry,
        });
      } else {
        // Create the document with the movies map
        await setDoc(docRef, { movies: { [movieId]: entry } });
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
