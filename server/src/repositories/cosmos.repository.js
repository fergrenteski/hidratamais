import { initCosmos } from '../../scripts/init-cosmos.js';

const strip = (doc) => {
  if (!doc) return null;
  const { _rid, _self, _etag, _attachments, _ts, ...rest } = doc;
  return rest;
};

export async function createCosmosRepository(cosmosConfig) {
  const { db, users, intakes } = await initCosmos(cosmosConfig);

  return {
    driver: 'cosmos',

    async ping() {
      await db.read();
    },

    async createUser(user) {
      const { resource } = await users.items.create(user);
      return strip(resource);
    },

    async getUser(id) {
      try {
        const { resource } = await users.item(id, id).read();
        return strip(resource);
      } catch (err) {
        if (err.code === 404) return null;
        throw err;
      }
    },

    // ponytail: única query cross-partition (users tem pk /id). O container é pequeno;
    // se crescer, mantenha um container "names" com pk /nameLower.
    async findUsersByName(nameLower) {
      const { resources } = await users.items
        .query({
          query: 'SELECT c.id, c.name, c.createdAt FROM c WHERE c.nameLower = @n',
          parameters: [{ name: '@n', value: nameLower }],
        })
        .fetchAll();
      return resources;
    },

    async updateUser(user) {
      const { resource } = await users.item(user.id, user.id).replace(user);
      return strip(resource);
    },

    async deleteUser(id) {
      await users.item(id, id).delete();
    },

    async addIntake(intake) {
      const { resource } = await intakes.items.create(intake);
      return strip(resource);
    },

    async listIntakes(userId, { from, to } = {}) {
      let query = 'SELECT c.id, c.userId, c.amountMl, c.timestamp, c.localDate FROM c WHERE c.userId = @u';
      const parameters = [{ name: '@u', value: userId }];
      if (from) {
        query += ' AND c.localDate >= @from';
        parameters.push({ name: '@from', value: from });
      }
      if (to) {
        query += ' AND c.localDate <= @to';
        parameters.push({ name: '@to', value: to });
      }
      query += ' ORDER BY c.timestamp ASC';
      const { resources } = await intakes.items
        .query({ query, parameters }, { partitionKey: userId })
        .fetchAll();
      return resources;
    },

    async deleteIntake(userId, intakeId) {
      try {
        await intakes.item(intakeId, userId).delete();
        return true;
      } catch (err) {
        if (err.code === 404) return false;
        throw err;
      }
    },

    async deleteIntakesForUser(userId) {
      const { resources } = await intakes.items
        .query({ query: 'SELECT c.id FROM c WHERE c.userId = @u', parameters: [{ name: '@u', value: userId }] }, { partitionKey: userId })
        .fetchAll();
      for (const { id } of resources) await intakes.item(id, userId).delete();
    },
  };
}
