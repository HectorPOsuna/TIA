export interface ThermalParams {
  timeConstantMs: number;
  loadHeatGain: number;
  dissipationRate: number;
  fanDissipationMultiplier: number;
}

export const DEFAULT_THERMAL_PARAMS: ThermalParams = {
  timeConstantMs: 20000,
  loadHeatGain: 0.35,
  dissipationRate: 0.002,
  fanDissipationMultiplier: 3,
};

export const COMPUTE_DEMAND_HEAT = 0.07;
export const COOLDOWN_TASK_COOLING = 0.07;
export const INACTIVE_COOLING_TIME_MS = 60_000;

export function thermalStep(
  currentTemp: number,
  targetTemp: number,
  ambientTemp: number,
  workload: number,
  active: boolean,
  fanActive: boolean,
  dtMs: number,
  params: ThermalParams = DEFAULT_THERMAL_PARAMS,
  taskHeat = 0,
): number {
  const dt = dtMs / 1000;
  if (!active) {
    const inactiveTimeConstantS = INACTIVE_COOLING_TIME_MS / 1000;
    return currentTemp + ((ambientTemp - currentTemp) / inactiveTimeConstantS) * dt;
  }

  const timeConstantS = params.timeConstantMs / 1000;
  const convergence = (targetTemp - currentTemp) / timeConstantS;
  const loadHeat = params.loadHeatGain * workload + taskHeat;
  const dissipationFactor = fanActive ? params.fanDissipationMultiplier : 1;
  const dissipation =
    params.dissipationRate * (currentTemp - ambientTemp) * dissipationFactor;

  return currentTemp + (convergence + loadHeat - dissipation) * dt;
}