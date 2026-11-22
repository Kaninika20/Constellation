export const syncStudentDepartment = async (session, studentId, department) => {
  const name = typeof department === 'string' ? department.trim() : '';
  await session.run(`
    MATCH (s:Student {studentId: $studentId})-[r:BELONGS_TO]->(:Department)
    DELETE r
  `, { studentId });

  if (name) {
    await session.run(`
      MATCH (s:Student {studentId: $studentId})
      MERGE (d:Department {name: $name})
      MERGE (s)-[:BELONGS_TO]->(d)
    `, { studentId, name });
  }
};

export const syncCourseDepartment = async (session, courseCode, department) => {
  const name = typeof department === 'string' ? department.trim() : '';
  await session.run(`
    MATCH (c:Course {courseCode: $courseCode})-[r:OFFERED_BY]->(:Department)
    DELETE r
  `, { courseCode });

  if (name) {
    await session.run(`
      MATCH (c:Course {courseCode: $courseCode})
      MERGE (d:Department {name: $name})
      MERGE (c)-[:OFFERED_BY]->(d)
    `, { courseCode, name });
  }
};
