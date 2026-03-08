import Fastify from "fastify"
import cors from "@fastify/cors"
import mercurius from "mercurius"
import { schema } from "./schema/index.js"

const PORT = Number(process.env.PORT ?? 4000)

async function main() {
  const app = Fastify({ logger: true })

  await app.register(cors, {
    origin: ["http://localhost:5173", "http://localhost:3000"],
  })

  await app.register(mercurius, {
    schema,
    subscription: true,
    graphiql: true,
  })

  await app.listen({ port: PORT, host: "0.0.0.0" })
  console.log(`GraphQL server ready at http://localhost:${PORT}/graphiql`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
