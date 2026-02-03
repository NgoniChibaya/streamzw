import React from "react";
import { useEffect, useState, useContext } from "react";
import Banner from "../componets/Banner/Banner";
import Footer from "../componets/Footer/Footer";
import RowPost from "../componets/RowPost/RowPost";
import {
  originals,
  trending,
  comedy,
  horror,
  Adventure,
  SciFi,
  Animated,
  War,
  trendingSeries,
  UpcomingMovies,
} from "../Constants/URLs";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../Firebase/FirebaseConfig";
import { AuthContext } from "../Context/UserContext";

function Home() {
  const { User } = useContext(AuthContext);
  const [watchedMovies, setWatchedMovies] = useState([]);
  const [continueWatching, setContinueWatching] = useState([]);

  useEffect(() => {
    getDoc(doc(db, "WatchedMovies", User.uid)).then((result) => {
      if (result.exists()) {
        const mv = result.data();
        setWatchedMovies(mv.movies);
        
        // Filter for continue watching (not completed, has progress > 30s)
        const continuing = mv.movies
          .filter(m => m.progress > 30 && !m.completed)
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 10);
        setContinueWatching(continuing);
      }
    });
  }, []);

  return (
    <div>
      <Banner url={trending}></Banner>
      <div className="w-[99%] ml-1">
        <RowPost first title="Trending" url={trending} key={trending}></RowPost>
        {continueWatching.length > 0 && (
          <RowPost
            title="Continue Watching"
            movieData={continueWatching}
            showProgress={true}
            key="Continue Watching"
          />
        )}
        <RowPost title="Animated" url={Animated} key={Animated}></RowPost>
        {watchedMovies.length != 0 ? (
          <RowPost
            title="Watched Movies"
            movieData={watchedMovies}
            key={"Watched Movies"}
          ></RowPost>
        ) : null}
        <RowPost
          title="Netflix Originals"
          islarge
          url={originals}
          key={originals}
        ></RowPost>
        <RowPost
          title="Trending Series"
          url={trendingSeries}
          key={trendingSeries}
        ></RowPost>
        <RowPost title="Science Fiction" url={SciFi} key={SciFi}></RowPost>
        <RowPost title="Upcoming Movies" url={UpcomingMovies} key={UpcomingMovies}></RowPost>
        <RowPost title="Comedy" url={comedy} key={comedy}></RowPost>
        <RowPost title="Adventure" url={Adventure} key={Adventure}></RowPost>
        <RowPost title="Horror" url={horror} key={horror}></RowPost>
        <RowPost title="War" url={War} key={War}></RowPost>
      </div>
      <Footer></Footer>
    </div>
  );
}

export default Home;
