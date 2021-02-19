import { Book, Lib, parseInput } from "./parser";
import { permutations, writeSolution } from "../helpers";
import { Socket } from "dgram";

type LibGenetic = Lib & {
  orderedBooks: Book[];
  takenBooks: Book[];
};

type Solution = {
  score: number;
  time: number;
  lib: number[];
  takenBooks: Set<Book>;
};

const POPULATION_SIZE = 300;
const GENERATION_COUNT = 250;
const CONTEST_SIZE = 4;
const CROSSOVER_RATE = 0.5;
const MUTATION_PROBABILITY = 0.05;

function findBestSlution(solutions: Solution[]): Solution {
  return solutions.reduce((bestSolution, solution) =>
    bestSolution.score > solution.score ? bestSolution : solution
  );
}

function crossover(libraries1: number[], libraries2: number[]) {
  const libIds1 = libraries1;
  const libIds2 = libraries2;

  const firstCrossover = [
    ...new Set([
      ...libIds2.slice(0, Math.floor(libIds2.length * CROSSOVER_RATE)),
      ...libIds1,
    ]),
  ];

  const secondCrossover = [
    ...new Set([
      ...libIds1.slice(0, Math.floor(libIds1.length * CROSSOVER_RATE)),
      ...libIds2,
    ]),
  ];

  return [firstCrossover, secondCrossover];
}

function mutate(libraries: Number[]) {
  return libraries
    .reduce(
      (acc, curr) => {
        if (Math.random() > MUTATION_PROBABILITY) {
          acc[0].push(curr);
        } else {
          acc[1].push(curr);
        }
        return acc;
      },
      [[], []]
    )
    .flat();
}

function getSolutionWithScore(
  librariesCombination: number[],
  numDays: number,
  allLibrariesWithSortedBooks: Map<number, LibGenetic>
) {
  const solution: Solution = {
    score: 0,
    time: 0,
    lib: [],
    takenBooks: new Set(),
  };

  for (const libId of librariesCombination) {
    const lib = allLibrariesWithSortedBooks.get(libId);
    // const lib = { ...allLibrariesWithSortedBooks.get(libId) };
    // lib.orderedBooks = [...lib.orderedBooks];
    // lib.takenBooks = [];

    if (solution.time + lib.signupDays > numDays) {
      // solution.lib.push(lib.id);
      //I think we should not stop here because in crossover and mutation steps we want all libraries to be included
      continue;
    }
    solution.time += lib.signupDays;

    // Take all fucking books in score order
    let time_library = solution.time;
    let books_processed_per_day = 0;
    for (const book of lib.orderedBooks) {
      if (time_library > numDays) {
        break;
      }
      if (!solution.takenBooks.has(book)) {
        solution.takenBooks.add(book);
        // lib.takenBooks.push(book);
        solution.score += book.score;
        books_processed_per_day++;
        if (books_processed_per_day === lib.booksPerDay) {
          books_processed_per_day = 0;
          time_library++;
        }
      }
    }
    // solution.lib.push(lib.id);
  }

  solution.lib = librariesCombination;
  return solution;
}

async function solve(name: string) {
  const input = await parseInput(name);
  let TIME = 0;
  let maxScore = 0;

  const librariesWithSortedBooks: Map<number, LibGenetic> = new Map();

  for (const lib of input.libsMap.values()) {
    const libGenetic = lib as LibGenetic;
    libGenetic.orderedBooks = lib.books.sort((a, b) => b.score - a.score);
    librariesWithSortedBooks.set(libGenetic.id, libGenetic);
  }

  const libIds = Array.from(librariesWithSortedBooks.values()).map(
    (lib) => lib.id
  );

  let permutationNr = 0;
  const generations = [];
  let populations = [];
  // I wonder if making permutations random rather than always returning stable result is better
  for (const libComb of permutations(libIds)) {
    if (generations.length >= GENERATION_COUNT) {
      break;
    }

    if (permutationNr++ >= POPULATION_SIZE) {
      generations.push(populations);
      populations = [];
      permutationNr = 0;
    } else {
      populations.push(libComb);
    }
  }

  let generationNr = 0;
  let populationNr = 0;
  for (const generation of generations) {
    generationNr++;
    console.log("Generation Nr:", generationNr);
    // console.log(generation.slice(0, 2));
    let permutationSolutions: Solution[] = [];

    // console.log("Step #1");
    for (const libComb of generation) {
      // if (permutationNr++ >= POPULATION_SIZE) {
      //   break;
      // }

      const solution = getSolutionWithScore(
        libComb,
        input.numDays,
        librariesWithSortedBooks
      );
      permutationSolutions.push(solution);

      // console.log(
      //   "sol",
      //   libComb,
      //   solution.lib.map((l) => l.id),
      //   solution.score
      // );

      // writeSolution(
      //   `z_lukas_${libComb.join(",")}`,
      //   [
      //     sol.lib.length,
      //     sol.lib
      //       .map((lib) => {
      //         return [
      //           [lib.id, lib.takenBooks.length].join(" "),
      //           lib.takenBooks.map((book) => book.id).join(" "),
      //         ].join("\n");
      //       })
      //       .join("\n"),
      //   ].join("\n")
      // );
    }
    // console.log("Step #1 finished");

    // Step #2
    // Randomly choose N solutions and select one the winner
    // Do it twice to get a pair of winners
    for (let i = 0; i < Math.floor(POPULATION_SIZE / 2); i++) {
      const firstCompetitionCandidates = [];
      const secondCompetitionCandidates = [];
      // console.log("Step #2");
      for (let j = 0; j < CONTEST_SIZE; j++) {
        let randomSolutionIndex = Math.floor(
          Math.random() * permutationSolutions.length
        );
        firstCompetitionCandidates.push(
          permutationSolutions[randomSolutionIndex]
        );

        randomSolutionIndex = Math.floor(
          Math.random() * permutationSolutions.length
        );
        secondCompetitionCandidates.push(
          permutationSolutions[randomSolutionIndex]
        );
      }

      let firstCompetitionWinner = findBestSlution(firstCompetitionCandidates);
      let secondCompetitionWinner = findBestSlution(
        secondCompetitionCandidates
      );

      // console.log("Step #3");
      // Step #3
      // Do the crossover
      const [crossover1, crossover2] = crossover(
        firstCompetitionWinner.lib,
        secondCompetitionWinner.lib
      );
      // console.log(
      //   firstCompetitionWinner.lib.map((lib) => lib.id),
      //   secondCompetitionWinner.lib.map((lib) => lib.id)
      // );
      // console.log(crossover1);
      // console.log(crossover2);

      // Step #4
      // Do mutation
      // console.log("Step #4");
      const crossover1Mutated = mutate(crossover1);
      const crossover2Mutated = mutate(crossover2);

      const solution1 = getSolutionWithScore(
        crossover1Mutated,
        input.numDays,
        librariesWithSortedBooks
      );
      const solution2 = getSolutionWithScore(
        crossover2Mutated,
        input.numDays,
        librariesWithSortedBooks
      );
      if (maxScore < solution1.score) {
        console.log("New max score", solution1.score);
        maxScore = solution1.score;
      }
      if (maxScore < solution2.score) {
        console.log("New max score", solution2.score);
        maxScore = solution2.score;
      }
      // console.log(
      //   crossover1Mutated,
      // );
      // console.log(
      //   crossover2Mutated,
      //   getSolutionWithScore(
      //     crossover2Mutated,
      //     input.numDays,
      //     librariesWithSortedBooks
      //   ).score
      // );
      // console.log("--------------");
    }
    // console.log("Step #5");
  }
  console.log("Final max score", maxScore);
}

solve("b_read_on");
