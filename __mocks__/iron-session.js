// Mock for iron-session (ESM-only module that causes Jest parse errors)
module.exports = {
  getIronSession: jest.fn(() => ({
    userId: undefined,
    email: undefined,
    save: jest.fn(),
    destroy: jest.fn(),
  })),
};
