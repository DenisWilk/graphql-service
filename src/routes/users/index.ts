import { FastifyPluginAsyncJsonSchemaToTs } from '@fastify/type-provider-json-schema-to-ts';
import { idParamSchema } from '../../utils/reusedSchemas';
import {
  createUserBodySchema,
  changeUserBodySchema,
  subscribeBodySchema,
} from './schemas';
import type { UserEntity } from '../../utils/DB/entities/DBUsers';

const plugin: FastifyPluginAsyncJsonSchemaToTs = async (
  fastify
): Promise<void> => {
  fastify.get('/', async function (request, reply): Promise<UserEntity[]> {
    const users = fastify.db.users.findMany();

    return users;
  });

  fastify.get(
    '/:id',
    {
      schema: {
        params: idParamSchema,
      },
    },
    async function (request, reply): Promise<UserEntity> {
      const user = await fastify.db.users.findOne({
        key: 'id',
        equals: request.params.id,
      });

      if (!user) {
        throw fastify.httpErrors.notFound('Error! User id not found.');
      }

      return user;
    }
  );

  fastify.post(
    '/',
    {
      schema: {
        body: createUserBodySchema,
      },
    },
    async function (request, reply): Promise<UserEntity> {
      const user = await fastify.db.users.create(request.body);

      return user;
    }
  );

  fastify.delete(
    '/:id',
    {
      schema: {
        params: idParamSchema,
      },
    },
    async function (request, reply): Promise<UserEntity> {
      const user = await fastify.db.users.findOne({
        key: 'id',
        equals: request.params.id,
      });

      if (!user) {
        throw fastify.httpErrors.badRequest('Error! User id not found.');
      }

      const posts = await fastify.db.posts.findMany({
        key: 'userId',
        equals: request.params.id,
      });

      posts.map(async (post) => {
        await fastify.db.posts.delete(post.id);
      });

      const profile = await fastify.db.profiles.findOne({
        key: 'userId',
        equals: request.params.id,
      });

      if (profile) {
        await fastify.db.profiles.delete(profile.id);
      }

      const subscribers = await fastify.db.users.findMany({
        key: 'subscribedToUserIds',
        inArray: request.params.id,
      });

      subscribers.map(async (subscriber) => {
        subscriber.subscribedToUserIds.splice(
          subscriber.subscribedToUserIds.indexOf(request.params.id),
          1
        );

        await fastify.db.users.change(subscriber.id, {
          subscribedToUserIds: subscriber.subscribedToUserIds,
        });
      });

      return await fastify.db.users.delete(request.params.id);
    }
  );

  fastify.post(
    '/:id/subscribeTo',
    {
      schema: {
        body: subscribeBodySchema,
        params: idParamSchema,
      },
    },
    async function (request, reply): Promise<UserEntity> {
      const user = await fastify.db.users.findOne({
        key: 'id',
        equals: request.body.userId,
      });

      if (user) {
        const subscriber = await fastify.db.users.findOne({
          key: 'id',
          equals: request.params.id,
        });

        const subscription = user.subscribedToUserIds.includes(
          request.params.id
        );

        if (subscription) {
          return user;
        }

        if (subscriber) {
          const changedUser = await fastify.db.users.change(
            request.body.userId,
            {
              subscribedToUserIds: [
                ...user.subscribedToUserIds,
                request.params.id,
              ],
            }
          );

          return changedUser;
        }
      }

      throw fastify.httpErrors.badRequest();
    }
  );

  fastify.post(
    '/:id/unsubscribeFrom',
    {
      schema: {
        body: subscribeBodySchema,
        params: idParamSchema,
      },
    },
    async function (request, reply): Promise<UserEntity> {
      const user = await fastify.db.users.findOne({
        key: 'id',
        equals: request.body.userId,
      });

      if (user) {
        const subscriber = user.subscribedToUserIds.includes(request.params.id);

        if (subscriber) {
          return await fastify.db.users.change(request.body.userId, {
            subscribedToUserIds: user.subscribedToUserIds.filter(
              (id) => id !== request.params.id
            ),
          });
        }

        throw fastify.httpErrors.badRequest();
      }

      throw fastify.httpErrors.badRequest();
    }
  );

  fastify.patch(
    '/:id',
    {
      schema: {
        body: changeUserBodySchema,
        params: idParamSchema,
      },
    },
    async function (request, reply): Promise<UserEntity> {
      try {
        const changedUser = await fastify.db.users.change(
          request.params.id,
          request.body
        );

        return changedUser;
      } catch {
        throw fastify.httpErrors.badRequest();
      }
    }
  );
};

export default plugin;
