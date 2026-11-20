import { useEffect, useState } from 'react';
import api from '../services/api';

const PAGE_SIZE = 100;

export const useStudents = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const loadStudents = async () => {
      try {
        const allStudents = [];
        let total = 0;

        do {
          const response = await api.get('/students', {
            params: { limit: PAGE_SIZE, skip: allStudents.length }
          });
          const data = response.data?.data;
          if (!Array.isArray(data?.students)) {
            throw new Error('The student list response was invalid.');
          }

          allStudents.push(...data.students);
          const pageTotal = Number(data.total);
          total = Number.isFinite(pageTotal) ? pageTotal : allStudents.length;
          if (data.students.length === 0) break;
        } while (allStudents.length < total);

        allStudents.sort((a, b) =>
          (a.name || a.studentId).localeCompare(b.name || b.studentId) ||
          a.studentId.localeCompare(b.studentId)
        );
        if (active) setStudents(allStudents);
      } catch (requestError) {
        if (active) {
          setError(requestError.response?.data?.message || requestError.message || 'Could not load students.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadStudents();
    return () => { active = false; };
  }, []);

  return { students, loading, error };
};
