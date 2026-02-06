---
trigger: always_on
---

# TypeORM & Database Access Rules

- **Repository Pattern:**
  - Always use the `@InjectRepository(Entity)` decorator to inject repositories into services.
  - Avoid direct database access via `EntityManager` unless a transaction across multiple repositories is required.

- **Strictly No Raw SQL:**
  - Avoid `.query()` or `manager.query()` methods.
  - Use TypeORM's **QueryBuilder** for complex queries that cannot be handled by standard `find` methods.
  - If raw SQL is absolutely unavoidable (e.g., for highly specific database functions), it must be documented with a clear justification.

- **QueryBuilder Usage:**
  - When using `createQueryBuilder`, always use named parameters (e.g., `:id`) instead of template literals or string concatenation to prevent SQL Injection.
  - Use `.getMany()`, `.getOne()`, or `.getRawOne()` explicitly based on the expected result.

- **Entity Definitions:**
  - Follow `PascalCase` for Entity classes and `camelCase` for properties/columns.
  - Always define explicit types in `@Column()` decorators (e.g., `@Column({ type: 'varchar', length: 255 })`).
  - Use `@CreateDateColumn()` and `@UpdateDateColumn()` for automatic timestamping.

- **Relationships & Loading:**
  - Define relations clearly with `@ManyToOne`, `@OneToMany`, and `@ManyToMany`.
  - Prefer **Lazy Loading** or **Eager Loading** sparingly. Use the `relations` option in `find` or `.leftJoinAndSelect()` in QueryBuilder to fetch related data explicitly.
  - Always set `onDelete` actions for Foreign Keys (e.g., `onDelete: 'CASCADE'`).

- **Transactions:**
  - Use `DataSource.transaction()` or the `QueryRunner` API for complex operations involving multiple table updates to ensure atomicity.
  - Never perform heavy business logic inside a transaction block to avoid long-held database locks.

- **Migrations:**
  - Never use `synchronize: true` for production environments. 
  - Always generate and use migration files for schema changes to maintain version control over the database structure.