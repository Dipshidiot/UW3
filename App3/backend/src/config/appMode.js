export const isDemoModeOnly = () => String(process.env.DEMO_MODE_ONLY ?? 'true').trim().toLowerCase() !== 'false';

export const isDemoMemberLoginEnabled = () =>
  String(process.env.DEMO_ALLOW_MEMBER_LOGIN ?? 'false').trim().toLowerCase() === 'true';

export const isDemoMemberSignupEnabled = () =>
  String(process.env.DEMO_ALLOW_MEMBER_SIGNUP ?? 'false').trim().toLowerCase() === 'true';

export const setDemoModeOnly = (value) => {
  const nextValue = Boolean(value);
  process.env.DEMO_MODE_ONLY = nextValue ? 'true' : 'false';
  return nextValue;
};

export const getAppMode = () => {
  const demoModeOnly = isDemoModeOnly();
  const demoMemberLoginEnabled = isDemoMemberLoginEnabled();
  const demoMemberSignupEnabled = isDemoMemberSignupEnabled();

  return {
    demoModeOnly,
    mode: demoModeOnly ? 'demo-preview' : 'live',
    demoMemberLoginEnabled,
    demoMemberSignupEnabled,
  };
};

export default isDemoModeOnly;
