const https = require('https');

const url = 'https://firestore.googleapis.com/v1/projects/alnaseem-field-reports/databases/(default)/documents/qou_projects/proj_1261_midterm_default';

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const doc = JSON.parse(data);
      const fields = doc.fields || {};
      
      console.log('=== PROJECT METADATA ===');
      console.log('ID:', fields.id ? fields.id.stringValue : 'N/A');
      console.log('Updated At:', fields.updatedAt ? fields.updatedAt.stringValue : 'N/A');
      console.log('Exam Type:', fields.examType ? fields.examType.stringValue : 'N/A');
      console.log('Semester:', fields.semesterCode ? fields.semesterCode.stringValue : 'N/A');
      console.log('Is User Uploaded:', fields.isUserUploaded ? fields.isUserUploaded.booleanValue : 'N/A');
      console.log('Uploaded File Name:', fields.uploadedFileName ? fields.uploadedFileName.stringValue : 'N/A');
      console.log('Total Room Slots:', fields.totalRoomSlots ? fields.totalRoomSlots.integerValue : 'N/A');

      // Proctors inspection
      if (fields.proctors && fields.proctors.arrayValue) {
        const procs = fields.proctors.arrayValue.values || [];
        console.log('\n=== PROCTORS INSPECTION ===');
        console.log('Total Proctors Count in Firestore:', procs.length);
        
        let totalQuota = 0;
        let activeCount = 0;
        let zeroQuotaCount = 0;
        let academicCount = 0;
        let adminCount = 0;
        
        const proctorDetails = [];

        procs.forEach((pVal, idx) => {
          const map = pVal.mapValue.fields;
          const name = map.name ? map.name.stringValue : 'Unknown';
          const quota = map.quota ? parseInt(map.quota.integerValue || map.quota.stringValue || 0, 10) : 0;
          const classification = map.classification ? map.classification.stringValue : 'admin';
          const isActive = map.active !== undefined ? map.active.booleanValue : true;
          const isFrozen = map.frozen !== undefined ? map.frozen.booleanValue : false;
          
          if (classification === 'academic') academicCount++; else adminCount++;
          if (quota > 0 && isActive && !isFrozen) {
            activeCount++;
            totalQuota += quota;
          } else {
            zeroQuotaCount++;
          }

          proctorDetails.push({ name, quota, classification, isActive, isFrozen });
        });

        console.log('Active with Quota > 0:', activeCount);
        console.log('Zero Quota / Frozen / Inactive:', zeroQuotaCount);
        console.log('Academics:', academicCount, '| Admins:', adminCount);
        console.log('Total Quota Sum:', totalQuota);
        
        console.log('\nFull proctors listing:');
        proctorDetails.forEach((p, idx) => {
          console.log(`${idx + 1}. ${p.name} | Quota: ${p.quota} | Type: ${p.classification} | Active: ${p.isActive} | Frozen: ${p.isFrozen}`);
        });
      }

      // Schedule inspection
      if (fields.scheduleDays && fields.scheduleDays.arrayValue) {
        const days = fields.scheduleDays.arrayValue.values || [];
        console.log('\n=== SCHEDULE INSPECTION ===');
        console.log('Total Days in Firestore:', days.length);
        let totalRooms = 0;
        days.forEach((dVal, dIdx) => {
          const dMap = dVal.mapValue.fields;
          const dayName = dMap.dayName ? dMap.dayName.stringValue : '';
          const date = dMap.date ? dMap.date.stringValue : '';
          let dayRooms = 0;
          let sessionsInfo = [];
          if (dMap.sessions && dMap.sessions.arrayValue) {
            dMap.sessions.arrayValue.values.forEach(sVal => {
              const sMap = sVal.mapValue.fields;
              const sNum = sMap.sessionNumber ? sMap.sessionNumber.integerValue : '';
              const rCount = sMap.rooms && sMap.rooms.arrayValue ? sMap.rooms.arrayValue.values.length : 0;
              dayRooms += rCount;
              sessionsInfo.push(`S${sNum}: ${rCount} rooms`);
            });
          }
          totalRooms += dayRooms;
          console.log(`Day ${dIdx+1}: ${dayName} (${date}) -> ${dayRooms} rooms [${sessionsInfo.join(', ')}]`);
        });
        console.log('Total Rooms across all days:', totalRooms);
      }

      // Distribution result inspection
      if (fields.distributionResult && fields.distributionResult.mapValue) {
        const dist = fields.distributionResult.mapValue.fields;
        console.log('\n=== DISTRIBUTION RESULT IN FIRESTORE ===');
        const stats = dist.stats ? dist.stats.mapValue.fields : {};
        console.log('Stats:', Object.keys(stats).reduce((acc, k) => {
          acc[k] = stats[k].integerValue || stats[k].stringValue || stats[k].doubleValue;
          return acc;
        }, {}));
      }

    } catch(e) {
      console.error(e.message);
    }
  });
}).on('error', err => console.error(err.message));
