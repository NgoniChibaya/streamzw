import { genresList } from "../Constants/Constance";

const useGenereConverter = () => {
  const convertGenere = (genreIds) => {
    // Return empty array if genreIds is undefined, null, or not an array
    if (!genreIds || !Array.isArray(genreIds) || genreIds.length === 0) {
      return [];
    }
    
    try {
      const genresConvertedList = [];
      genreIds
        .slice(0, 3)
        .forEach((genreId) => {
          genresList
            .filter((el) => el.id === genreId)
            .forEach((el) => genresConvertedList.push(el.name));
        });

      return genresConvertedList;
    } catch (error) {
      console.error("Error converting genres:", error, genreIds);
      return [];
    }
  };

  return { convertGenere };
};

export default useGenereConverter;
