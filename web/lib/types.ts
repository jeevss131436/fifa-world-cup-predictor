export type Prediction = {
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  expected_goals_home: number;
  expected_goals_away: number;
  total_predicted_goals: number;
  rating_gap: number;
};

export type Fixture = {
  date: string;
  time_est: string;
  matchday: string;
  home_team: string;
  away_team: string;
  city: string;
  stadium: string;
  group: string;
};

export type CompletedMatch = {
  fixture: Fixture;
  home_score: number;
  away_score: number;
  expected_goals_home: number;
  expected_goals_away: number;
};

export type TeamStats = {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

// Group letter (A-L) -> sorted list of teams in that group.
export type Groups = Record<string, string[]>;
