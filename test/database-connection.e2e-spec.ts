import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app-module';

describe('Database Connection (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Pobierz aktywną instancję DataSource do weryfikacji bazy
    dataSource = app.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('powinien pomyślnie zainicjalizować połączenie (TypeORM)', () => {
    expect(dataSource.isInitialized).toBe(true);
  });

  it('powinien poprawnie wykonać proste zapytanie (SELECT 1)', async () => {
    const result = await dataSource.query('SELECT 1 as result');
    expect(result[0].result).toBe(1);
  });

  it('powinien widzieć dane załadowane z test_db.sql', async () => {
    // Sprawdzamy czy schemat auth i tabele istnieją (założone przez test_db.sql)
    const result = await dataSource.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'auth' AND table_name = 'users'
    `);
    
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].table_name).toBe('users');
  });
});
