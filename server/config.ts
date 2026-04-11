export const config = {
  port: Number(process.env.PORT || 2567),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://nexvoffice:nexvoffice_dev@localhost:5432/nexvoffice',
  jwtSecret: process.env.JWT_SECRET || 'nexvoffice_dev_secret',
  jwtExpiresIn: '24h',
  bcryptRounds: 10,
  awsRegion: process.env.AWS_REGION || 'us-east-1',
}
