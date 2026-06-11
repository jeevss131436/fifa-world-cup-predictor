import torch
import torch.nn as nn
import numpy as np
import pandas as pd
import pickle

# 1. Define Model Architecture (Must match your training setup exactly)
class PolynomialRegressionModel(nn.Module):
    def __init__(self, input_dim):
        super(PolynomialRegressionModel, self).__init__()
        self.linear = nn.Linear(input_dim, 1)
        
    def forward(self, x):
        return self.linear(x)

# 2. Global initializations (Load data and model assets once when server starts)
print("📦 Loading simulation assets...")

# Load your preprocessed datasets
# (Make sure these match your exact dataframe variables from your notebook)
df_values = pd.read_csv('data/squad_values.csv') 
df_momentum = pd.read_csv('data/processed_momentum.csv')
pos_averages = pd.read_csv('data/processed_squad_strength.csv')
val_name = 'market_value' # or whatever your column name is

# Load ML components
with open('scaler.pkl', 'rb') as f:
    scaler = pickle.load(f)

model = PolynomialRegressionModel(input_dim=8)
model.load_state_dict(torch.load('world_cup_model.pth'))
model.eval()

# 3. The Core Prediction Function
def get_match_prediction(home_team, away_team):
    try:
        # Pull metrics
        home_v = df_values[df_values['country'] == home_team][val_name].values[0]
        home_r = df_momentum[df_momentum['country'] == home_team]['current_rank'].values[0]
        home_s = pos_averages[pos_averages['country'] == home_team]['weighted_squad_strength'].values[0]
        
        away_v = df_values[df_values['country'] == away_team][val_name].values[0]
        away_r = df_momentum[df_momentum['country'] == away_team]['current_rank'].values[0]
        away_s = pos_averages[pos_averages['country'] == away_team]['weighted_squad_strength'].values[0]
    except IndexError:
        return {"error": f"One of the teams ({home_team} or {away_team}) was not found in database."}

    # Calculate differences
    rank_diff = home_r - away_r
    value_diff = home_v - away_v
    rating_diff = home_s - away_s
    momentum_diff = 0 # Optional placeholder or pass real momentum if tracking
    
    raw_features = np.array([[
        rank_diff, value_diff, rating_diff, momentum_diff,
        rank_diff**2, value_diff**2, rating_diff**2, momentum_diff**2
    ]])
    
    scaled_features = scaler.transform(raw_features)
    features_tensor = torch.tensor(scaled_features, dtype=torch.float32)
    
    with torch.no_grad():
        predicted_total_goals = max(0, model(features_tensor).item())
        
    # Tournament Host Logic
    hosts = ["United States", "USA", "Mexico", "Canada"]
    home_modifier = 1.03 if home_team in hosts else 1.00
    away_modifier = 1.03 if away_team in hosts else 1.00
    
    home_base_power = (home_s * home_modifier) + (500 / max(1, home_r))
    away_base_power = (away_s * away_modifier) + (500 / max(1, away_r))
    
    # Dynamic sensitivity exponent
    abs_rating_gap = abs(home_s - away_s)
    dynamic_exponent = 1.1 + (abs_rating_gap / 20.0)
    
    home_scaled_power = home_base_power ** dynamic_exponent
    away_scaled_power = away_base_power ** dynamic_exponent
    total_power = home_scaled_power + away_scaled_power
    
    home_predicted_goals = predicted_total_goals * (home_scaled_power / total_power)
    away_predicted_goals = predicted_total_goals * (away_scaled_power / total_power)
    
    # Sample integer scores from a Poisson distribution so repeated simulations
    # of the same fixture produce different results. The xG values remain the
    # deterministic expected goals (λ) and are returned separately for display.
    home_score = int(np.random.poisson(max(0.05, home_predicted_goals)))
    away_score = int(np.random.poisson(max(0.05, away_predicted_goals)))

    return {
        "home_team": home_team,
        "away_team": away_team,
        "home_score": home_score,
        "away_score": away_score,
        "expected_goals_home": round(home_predicted_goals, 2),
        "expected_goals_away": round(away_predicted_goals, 2),
        "total_predicted_goals": round(predicted_total_goals, 2),
        "rating_gap": round(rating_diff, 2)
    }