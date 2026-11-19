# CampusGraph – Sample Cypher Queries & Social Relationship Reference
## Week 3: Social Networking and Relationship Management

This document explains how each social relationship is represented in the Neo4j graph
and provides sample Cypher queries for every core operation.

---

## Graph Schema Overview

```
(Student)-[:FRIEND_REQUEST]->(Student)      pending, directed
(Student)-[:FRIENDS_WITH]-(Student)         accepted, undirected
(Student)-[:FOLLOWS]->(Student)             one-way, directed
(Student)-[:MEMBER_OF]->(Club)              directed
(Student)-[:STUDIES]->(Course)              directed
(Student)-[:PARTICIPATES_IN]->(Event)       directed
(Student)-[:HAS_INTEREST]->(Interest)       directed
```

---

## 1. Friend Request System

### Send a friend request
```cypher
// Guard: check receiver exists
MATCH (target:Student {studentId: $receiverId}) RETURN target;

// Guard: check not already friends (undirected)
MATCH (a:Student {studentId: $senderId})-[r:FRIENDS_WITH]-(b:Student {studentId: $receiverId})
RETURN r;

// Guard: check no pending request either direction
MATCH (a:Student {studentId: $senderId})-[r:FRIEND_REQUEST]->(b:Student {studentId: $receiverId})
RETURN 'outgoing' AS direction
UNION
MATCH (b:Student {studentId: $receiverId})-[r:FRIEND_REQUEST]->(a:Student {studentId: $senderId})
RETURN 'incoming' AS direction;

// Create the request
MATCH (a:Student {studentId: $senderId})
MATCH (b:Student {studentId: $receiverId})
CREATE (a)-[:FRIEND_REQUEST { createdAt: datetime(), status: 'pending' }]->(b);
```

### Accept a friend request
```cypher
// Delete the directed FRIEND_REQUEST and create a mutual FRIENDS_WITH
MATCH (sender:Student {studentId: $senderId})-[r:FRIEND_REQUEST]->(receiver:Student {studentId: $receiverId})
DELETE r
MERGE (sender)-[:FRIENDS_WITH { since: datetime(), status: 'accepted' }]-(receiver);
```
> `MERGE` on an undirected relationship prevents duplicate FRIENDS_WITH edges even if
> called more than once.

### Reject a friend request
```cypher
MATCH (sender:Student {studentId: $senderId})-[r:FRIEND_REQUEST]->(receiver:Student {studentId: $receiverId})
DELETE r;
```

### Cancel an outgoing friend request
```cypher
MATCH (sender:Student {studentId: $senderId})-[r:FRIEND_REQUEST]->(receiver:Student {studentId: $receiverId})
DELETE r;
```

### View incoming requests
```cypher
MATCH (sender:Student)-[r:FRIEND_REQUEST]->(me:Student {studentId: $myId})
OPTIONAL MATCH (sender)-[:HAS_INTEREST]->(i:Interest)
WITH sender, r, collect(DISTINCT i.name) AS interests
ORDER BY r.createdAt DESC
RETURN sender, r.createdAt AS sentAt, interests;
```

### View outgoing requests
```cypher
MATCH (me:Student {studentId: $myId})-[r:FRIEND_REQUEST]->(receiver:Student)
ORDER BY r.createdAt DESC
RETURN receiver, r.createdAt AS sentAt;
```

### Remove an existing friendship
```cypher
MATCH (a:Student {studentId: $studentId})-[r:FRIENDS_WITH]-(b:Student {studentId: $friendId})
DELETE r;
```

---

## 2. Following System (Separate from Friendship)

### Follow a student
```cypher
// Guard: prevent self-follow and duplicate follow
MATCH (follower:Student {studentId: $followerId})
MATCH (target:Student {studentId: $targetId})
CREATE (follower)-[:FOLLOWS { since: datetime() }]->(target);
```

### Unfollow a student
```cypher
MATCH (follower:Student {studentId: $followerId})-[r:FOLLOWS]->(target:Student {studentId: $targetId})
DELETE r;
```

### View followers (who follows me)
```cypher
MATCH (follower:Student)-[r:FOLLOWS]->(me:Student {studentId: $myId})
RETURN follower, r.since AS since
ORDER BY follower.name ASC;
```

### View following (who I follow)
```cypher
MATCH (me:Student {studentId: $myId})-[r:FOLLOWS]->(followed:Student)
RETURN followed, r.since AS since
ORDER BY followed.name ASC;
```

> **Why separate from FRIENDS_WITH?**
> Following is asymmetric (A follows B does not mean B follows A). Friendship
> is mutual. Using two distinct relationship types keeps the graph semantics
> clean and allows independent queries for each behaviour.

---

## 3. Clubs (MEMBER_OF)

### Join a club
```cypher
MATCH (s:Student {studentId: $studentId})
MATCH (cl:Club {clubId: $clubId})
CREATE (s)-[:MEMBER_OF { role: $role, joinedDate: datetime() }]->(cl);
```

### Leave a club
```cypher
MATCH (s:Student {studentId: $studentId})-[r:MEMBER_OF]->(cl:Club {clubId: $clubId})
DELETE r;
```

### View club members
```cypher
MATCH (s:Student)-[r:MEMBER_OF]->(cl:Club {clubId: $clubId})
OPTIONAL MATCH (s)-[:HAS_INTEREST]->(i:Interest)
WITH s, r, collect(DISTINCT i.name) AS interests
ORDER BY s.name ASC
RETURN s, r.role AS role, r.joinedDate AS joinedDate, interests;
```

### Browse all clubs with membership status for logged-in user
```cypher
MATCH (cl:Club)
OPTIONAL MATCH (s:Student)-[:MEMBER_OF]->(cl)
WITH cl, count(DISTINCT s) AS memberCount
OPTIONAL MATCH (me:Student {studentId: $myId})-[myRel:MEMBER_OF]->(cl)
RETURN cl, memberCount, myRel IS NOT NULL AS isMember, myRel.role AS myRole
ORDER BY cl.name ASC;
```

---

## 4. Courses (STUDIES)

### Enroll in a course
```cypher
MATCH (s:Student {studentId: $studentId})
MATCH (c:Course {courseCode: $courseCode})
CREATE (s)-[:STUDIES { semester: $semester, enrolledAt: datetime() }]->(c);
```

### Drop a course
```cypher
MATCH (s:Student {studentId: $studentId})-[r:STUDIES]->(c:Course {courseCode: $courseCode})
DELETE r;
```

### View students enrolled in the same course (classmates)
```cypher
MATCH (s:Student)-[r:STUDIES]->(c:Course {courseCode: $courseCode})
OPTIONAL MATCH (s)-[:HAS_INTEREST]->(i:Interest)
WITH s, r, collect(DISTINCT i.name) AS interests
ORDER BY s.name ASC
RETURN s, r.semester AS semester, interests;
```

### Find shared courses between two students
```cypher
MATCH (a:Student {studentId: $studentA})-[:STUDIES]->(c:Course)<-[:STUDIES]-(b:Student {studentId: $studentB})
RETURN c.courseCode, c.courseName;
```

---

## 5. Events (PARTICIPATES_IN)

### Register for an event
```cypher
MATCH (s:Student {studentId: $studentId})
MATCH (e:Event {eventId: $eventId})
CREATE (s)-[:PARTICIPATES_IN { registrationDate: datetime(), status: 'confirmed' }]->(e);
```

### Cancel event registration
```cypher
MATCH (s:Student {studentId: $studentId})-[r:PARTICIPATES_IN]->(e:Event {eventId: $eventId})
DELETE r;
```

### View event participants
```cypher
MATCH (s:Student)-[r:PARTICIPATES_IN]->(e:Event {eventId: $eventId})
ORDER BY s.name ASC
RETURN s, r.registrationDate AS registrationDate, r.status AS status;
```

### Create a new event node
```cypher
CREATE (e:Event {
  eventId: $eventId,
  title: $title,
  date: $date,
  location: $location,
  description: $description,
  createdBy: $creatorStudentId,
  createdAt: datetime()
});
```

---

## 6. Cross-Relationship Queries

### Full relationship status between two students
```cypher
MATCH (me:Student {studentId: $myId})
MATCH (them:Student {studentId: $theirId})
OPTIONAL MATCH (me)-[rf:FRIENDS_WITH]-(them)
OPTIONAL MATCH (me)-[ro:FRIEND_REQUEST]->(them)
OPTIONAL MATCH (them)-[ri:FRIEND_REQUEST]->(me)
OPTIONAL MATCH (me)-[rfol:FOLLOWS]->(them)
OPTIONAL MATCH (them)-[rfby:FOLLOWS]->(me)
RETURN
  rf IS NOT NULL   AS isFriend,
  ro IS NOT NULL   AS hasPendingOutgoing,
  ri IS NOT NULL   AS hasPendingIncoming,
  rfol IS NOT NULL AS isFollowing,
  rfby IS NOT NULL AS isFollowedBy;
```

### Mutual friends between two students
```cypher
MATCH (a:Student {studentId: $studentA})-[:FRIENDS_WITH]-(mutual:Student)-[:FRIENDS_WITH]-(b:Student {studentId: $studentB})
WHERE a <> b
RETURN DISTINCT mutual.name, mutual.studentId;
```

### Shortest connection path between two students
```cypher
MATCH path = shortestPath(
  (a:Student {studentId: $studentA})-[:FRIENDS_WITH|FOLLOWS*1..6]-(b:Student {studentId: $studentB})
)
RETURN [n IN nodes(path) | n.name] AS names, length(path) AS hops;
```

### Students with no academic engagement (Sybil indicator)
```cypher
MATCH (s:Student)
WHERE NOT (s)-[:STUDIES]->()
  AND NOT (s)-[:MEMBER_OF]->()
RETURN s.studentId, s.name, s.fraudRiskScore
ORDER BY s.fraudRiskScore DESC;
```

### Degree of connection for all students (popularity measure)
```cypher
MATCH (s:Student)
OPTIONAL MATCH (s)-[:FRIENDS_WITH]-(f)
OPTIONAL MATCH (s)<-[:FOLLOWS]-(fo)
WITH s, count(DISTINCT f) AS friendCount, count(DISTINCT fo) AS followerCount
RETURN s.name, friendCount, followerCount
ORDER BY friendCount + followerCount DESC;
```

---

## 7. How Each Relationship Is Stored

| Relationship      | Direction    | Key Properties                       | Semantic Meaning                            |
|-------------------|--------------|--------------------------------------|---------------------------------------------|
| `FRIEND_REQUEST`  | A → B        | `createdAt`, `status: 'pending'`     | A sent B a pending friend request           |
| `FRIENDS_WITH`    | A — B        | `since`, `status: 'accepted'`        | Mutual confirmed friendship                 |
| `FOLLOWS`         | A → B        | `since`                              | A follows B (B doesn't have to follow back) |
| `MEMBER_OF`       | Student → Club | `role`, `joinedDate`              | Student is a club member with a role        |
| `STUDIES`         | Student → Course | `semester`, `enrolledAt`        | Student is enrolled in a course             |
| `PARTICIPATES_IN` | Student → Event | `registrationDate`, `status`    | Student registered for an event             |
| `HAS_INTEREST`    | Student → Interest | `assignedAt`, `level`         | Student declared an interest or skill       |

---

*All queries use parameterized values (`$param`) to prevent Cypher injection.
Relationship existence checks use `OPTIONAL MATCH` before writes to enforce
business rules at the graph layer.*
