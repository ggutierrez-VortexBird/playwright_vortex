// Mock de iron-session (módulo solo ESM que rompe el parser de Jest)
module.exports = {
  getIronSession: jest.fn(() => ({
    userId: undefined,
    email: undefined,
    save: jest.fn(),
    destroy: jest.fn(),
  })),
};
