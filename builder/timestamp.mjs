export const getYYYYMMDD = (dateObj) => {
    return dateObj.toISOString().split('T')[0]; 
}

export const getSimpleTimestamp = () => {
    return getYYYYMMDD(new Date());
}

export const getYear = () => {
    return getSimpleTimestamp().split('-')[0];
}