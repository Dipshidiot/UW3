export const isDemoModeOnly = () => String(process.env.DEMO_MODE_ONLY ?? 'true').trim().toLowerCase() !== 'false';

export const setDemoModeOnly = (value) => {
  const nextValue = Boolean(value);
  process.env.DEMO_MODE_ONLY = nextValue ? 'true' : 'false';
  return nextValue;
};

export const getAppMode = () => {
  const demoModeOnly = isDemoModeOnly();

  return {
    demoModeOnly,
    mode: demoModeOnly ? 'demo-preview' : 'live',
  };
};

export default isDemoModeOnly;
