import express from 'express';

interface Request extends express.Request {
    query: {
        emailAddress: string;
        password: string;
    };
    };
