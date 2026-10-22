// Driver em memória (DB_DRIVER=memory): mesma interface do Cosmos, dados somem ao reiniciar.
export function createMemoryRepository() {
  const users = new Map();
  const intakes = new Map(); // userId -> Map(intakeId -> intake)
  const copy = (x) => (x ? structuredClone(x) : null);

  return {
    driver: 'memory',
    async ping() {},

    async createUser(user) {
      users.set(user.id, copy(user));
      return copy(user);
    },
    async getUser(id) {
      return copy(users.get(id));
    },
    async findUsersByName(nameLower) {
      return [...users.values()]
        .filter((u) => u.nameLower === nameLower)
        .map(({ id, name, createdAt }) => ({ id, name, createdAt }));
    },
    async updateUser(user) {
      users.set(user.id, copy(user));
      return copy(user);
    },
    async deleteUser(id) {
      users.delete(id);
    },

    async addIntake(intake) {
      if (!intakes.has(intake.userId)) intakes.set(intake.userId, new Map());
      intakes.get(intake.userId).set(intake.id, copy(intake));
      return copy(intake);
    },
    async listIntakes(userId, { from, to } = {}) {
      return [...(intakes.get(userId)?.values() ?? [])]
        .filter((i) => (!from || i.localDate >= from) && (!to || i.localDate <= to))
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        .map(copy);
    },
    async deleteIntake(userId, intakeId) {
      return intakes.get(userId)?.delete(intakeId) ?? false;
    },
    async deleteIntakesForUser(userId) {
      intakes.delete(userId);
    },
  };
}
